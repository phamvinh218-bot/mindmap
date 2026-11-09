// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { useAutosave, confirmLeave } from '@/editor/useAutosave';
import { createEditorStore } from '@/editor/store';
import { isShortcutTarget } from '@/editor/keyboard';
import { MindNodeBody, type MindNodeData } from '@/editor/MindNodeView';
import { newMapData } from '@/lib/db/repo';
import { getRoot, updateNodes } from '@/lib/tree';
import { createMemoryRepo } from '@/lib/db/memoryRepo';
import { attempt, clearAttempts, RATE } from '@/lib/auth/rateLimit';

describe('review fix: leaving the editor', () => {
  it('leaves when the flush leaves nothing dirty', async () => {
    const ask = vi.fn(() => false);
    expect(await confirmLeave(async () => {}, () => false, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
  it('asks before leaving with unsaved edits, and stays on "no"', async () => {
    const ask = vi.fn(() => false);
    expect(await confirmLeave(async () => {}, () => true, ask)).toBe(false);
    expect(ask).toHaveBeenCalledWith('Có thay đổi chưa lưu được. Vẫn rời khỏi trang?');
    expect(await confirmLeave(async () => {}, () => true, () => true)).toBe(true);
  });
});

describe('review fix: 404 on save', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('blocks with "gone" instead of retrying forever', async () => {
    const store = createEditorStore('owner:g');
    const d = newMapData('Gốc');
    store.getState().load(d, 1, false);
    const save = vi.fn(async () => ({ ok: false as const, status: 404 as const }));
    const hook = renderHook(() => useAutosave(store, { save, getVersion: vi.fn(), load: vi.fn() }, {}));
    act(() => store.getState().apply((x) => updateNodes(x, [getRoot(d).id], { text: 'A' })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(hook.result.current.status).toBe('gone');
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('review fix: shortcuts only from the canvas', () => {
  it('ignores focused buttons and links, accepts body and canvas', () => {
    document.body.innerHTML = '<button id="b">x</button><a id="a" href="#">y</a><div data-mm-canvas><div id="c"></div></div>';
    expect(isShortcutTarget(document.getElementById('b'))).toBe(false);
    expect(isShortcutTarget(document.getElementById('a'))).toBe(false);
    expect(isShortcutTarget(document.getElementById('c'))).toBe(true);
    expect(isShortcutTarget(document.body)).toBe(true);
  });
});

describe('review fix: concurrent login attempts', () => {
  it('lets at most RATE.max of many parallel attempts through', async () => {
    const repo = createMemoryRepo();
    const results = await Promise.all(Array.from({ length: 30 }, () => attempt(repo, 'k')));
    expect(results.filter(Boolean).length).toBe(RATE.max);
  });
  it('a success clears earlier failures', async () => {
    const repo = createMemoryRepo();
    for (let i = 0; i < 4; i++) await attempt(repo, 'k');
    await clearAttempts(repo, 'k');
    expect(await attempt(repo, 'k')).toBe(true);
  });
});

describe('review fix: typeahead cannot get stuck', () => {
  it('gives up editing when the text box never takes focus', async () => {
    vi.useFakeTimers();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {});
    const commitText = vi.fn();
    const data: MindNodeData = {
      node: { id: 'n', parentId: 'r', text: '', color: '#000', shape: 'rounded', x: 0, y: 0 },
      isRoot: false, editing: true, readOnly: false, childCount: 0, collapsed: false, link: null, connecting: false,
      actions: { commitText, startEdit: vi.fn(), toggleCollapse: vi.fn(), openLink: vi.fn(), takeTypeahead: () => '' },
    };
    render(<ReactFlowProvider><MindNodeBody data={data} selected={false} /></ReactFlowProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(commitText).toHaveBeenCalledWith('n', null);
    focus.mockRestore();
    vi.useRealTimers();
  });
});
