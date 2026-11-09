// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '@/editor/useAutosave';
import { createEditorStore } from '@/editor/store';
import type { EditorApi, SaveResult } from '@/editor/api';
import { newMapData } from '@/lib/db/repo';
import { getRoot, updateNodes } from '@/lib/tree';
import type { MapData } from '@/lib/types';

function setup(opts: { readOnly?: boolean; save?: (d: MapData, v: number) => Promise<SaveResult> } = {}) {
  const store = createEditorStore('owner:t');
  const d = newMapData('Gốc');
  store.getState().load(d, 1, !!opts.readOnly);
  const root = getRoot(d).id;
  const api: EditorApi & { save: ReturnType<typeof vi.fn>; getVersion: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> } = {
    save: vi.fn(opts.save ?? (async (_d: MapData, v: number) => ({ ok: true as const, version: v + 1 }))),
    getVersion: vi.fn(async () => store.getState().version),
    load: vi.fn(async () => ({ data: newMapData('Bản mới'), version: 9 })),
  };
  const hook = renderHook(() => useAutosave(store, api, {}));
  const edit = (text: string) => act(() => store.getState().apply((x) => updateNodes(x, [root], { text })));
  return { store, api, hook, edit };
}

const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAutosave', () => {
  it('saves 1500 ms after the last edit with the current version', async () => {
    const { api, hook, edit, store } = setup();
    edit('A');
    await flush(1499);
    expect(api.save).not.toHaveBeenCalled();
    await flush(1);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0][1]).toBe(1);
    expect(hook.result.current.status).toBe('saved');
    expect(store.getState()).toMatchObject({ dirty: false, version: 2 });
  });

  it('a 409 enters conflict and stops saving later edits', async () => {
    const { api, hook, edit } = setup({ save: async () => ({ ok: false, status: 409, version: 5 }) });
    edit('A');
    await flush(1500);
    expect(hook.result.current.status).toBe('conflict');
    edit('B');
    await flush(5000);
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it('a network failure keeps edits and retries after 5 s', async () => {
    let fail = true;
    const { api, hook, edit, store } = setup({
      save: async (_d, v) => (fail ? { ok: false, status: 0 } : { ok: true, version: v + 1 }),
    });
    edit('A');
    await flush(1500);
    expect(hook.result.current.status).toBe('error');
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().data.nodes[0].text).toBe('A');
    fail = false;
    await flush(5000);
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(hook.result.current.status).toBe('saved');
  });

  it('a 401 marks the session expired, keeps data and does not retry', async () => {
    const { api, hook, edit, store } = setup({ save: async () => ({ ok: false, status: 401 }) });
    edit('A');
    await flush(1500);
    expect(hook.result.current.status).toBe('expired');
    await flush(20000);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(store.getState().data.nodes[0].text).toBe('A');
  });

  it('warns before unload only while there are unsaved edits', async () => {
    const { edit } = setup();
    const ev1 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev1);
    expect(ev1.defaultPrevented).toBe(false);
    edit('A');
    const ev2 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(true);
  });

  it('on becoming visible: reloads silently when clean, conflicts when dirty', async () => {
    const clean = setup();
    clean.api.getVersion.mockResolvedValue(7);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(clean.api.load).toHaveBeenCalled();
    expect(clean.store.getState().version).toBe(9);
    clean.hook.unmount();

    const dirty = setup();
    dirty.edit('mine');
    dirty.api.getVersion.mockResolvedValue(7);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(dirty.hook.result.current.status).toBe('conflict');
    expect(dirty.store.getState().data.nodes[0].text).toBe('mine');
  });

  it('saveNow saves immediately', async () => {
    const { api, hook, edit } = setup();
    edit('A');
    await act(async () => {
      hook.result.current.saveNow();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it('never saves in view mode', async () => {
    const { api } = setup({ readOnly: true });
    await flush(10000);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('reloadLatest loads the newest version and clears the conflict', async () => {
    const { hook, edit, store } = setup({ save: async () => ({ ok: false, status: 409, version: 5 }) });
    edit('A');
    await flush(1500);
    await act(async () => {
      await hook.result.current.reloadLatest();
    });
    expect(hook.result.current.status).toBe('saved');
    expect(store.getState()).toMatchObject({ version: 9, dirty: false });
    expect(store.getState().data.nodes[0].text).toBe('Bản mới');
  });
});
