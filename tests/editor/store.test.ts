// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEditorStore } from '@/editor/store';
import { loadViewerState, saveViewerState } from '@/lib/viewerState';
import { newMapData } from '@/lib/db/repo';
import { addChild, getRoot, updateNodes } from '@/lib/tree';

beforeEach(() => localStorage.clear());

function setup(readOnly = false) {
  const store = createEditorStore('owner:m1');
  const d = newMapData('Gốc');
  store.getState().load(d, 1, readOnly);
  return { store, root: getRoot(d).id };
}
const rename = (id: string, text: string) => (d: ReturnType<typeof newMapData>) => updateNodes(d, [id], { text });

describe('editor store', () => {
  it('load resets dirty and history', () => {
    const { store, root } = setup();
    store.getState().apply(rename(root, 'A'));
    expect(store.getState().dirty).toBe(true);
    store.getState().load(newMapData('X'), 5, false);
    expect(store.getState()).toMatchObject({ dirty: false, version: 5 });
    store.getState().undo();
    expect(store.getState().data.nodes[0].text).toBe('X');
  });

  it('undo history is capped at 100 steps', () => {
    const { store, root } = setup();
    for (let i = 1; i <= 101; i++) store.getState().apply(rename(root, `v${i}`));
    for (let i = 0; i < 150; i++) store.getState().undo();
    expect(store.getState().data.nodes[0].text).toBe('v1');
  });

  it('redo restores and a new apply clears the redo stack', () => {
    const { store, root } = setup();
    store.getState().apply(rename(root, 'A'));
    store.getState().apply(rename(root, 'B'));
    store.getState().undo();
    expect(store.getState().data.nodes[0].text).toBe('A');
    store.getState().redo();
    expect(store.getState().data.nodes[0].text).toBe('B');
    store.getState().undo();
    store.getState().apply(rename(root, 'C'));
    store.getState().redo();
    expect(store.getState().data.nodes[0].text).toBe('C');
  });

  it('apply is a no-op when read-only', () => {
    const { store, root } = setup(true);
    const before = store.getState().data;
    store.getState().apply((d) => addChild(d, root).data);
    expect(store.getState().data).toBe(before);
    expect(store.getState().dirty).toBe(false);
  });

  it('apply that returns the same object does not dirty or push history', () => {
    const { store } = setup();
    store.getState().apply((d) => d);
    expect(store.getState().dirty).toBe(false);
  });

  it('toggleCollapsed persists per viewer and does not dirty the map', () => {
    const { store, root } = setup();
    store.getState().toggleCollapsed(root);
    expect(store.getState().collapsed.has(root)).toBe(true);
    expect(store.getState().dirty).toBe(false);
    expect(loadViewerState('owner:m1').collapsed).toEqual([root]);
  });

  it('works read-only for collapse too', () => {
    const { store, root } = setup(true);
    store.getState().toggleCollapsed(root);
    expect(store.getState().collapsed.has(root)).toBe(true);
  });

  it('markSaved keeps dirty when an edit landed during the save', () => {
    const { store, root } = setup();
    store.getState().apply(rename(root, 'A'));
    const sent = store.getState().data;
    store.getState().apply(rename(root, 'B'));
    store.getState().markSaved(2, sent);
    expect(store.getState()).toMatchObject({ dirty: true, version: 2 });
    store.getState().markSaved(3, store.getState().data);
    expect(store.getState().dirty).toBe(false);
  });

  it('buffers keys typed before the new node input has focus, and clears them on a new edit', () => {
    const { store, root } = setup();
    store.getState().setEditing(root);
    store.getState().pushTypeahead('X');
    store.getState().pushTypeahead('y');
    expect(store.getState().takeTypeahead()).toBe('Xy');
    expect(store.getState().takeTypeahead()).toBe('');
    store.getState().pushTypeahead('z');
    store.getState().setEditing(null);
    store.getState().setEditing(root);
    expect(store.getState().takeTypeahead()).toBe('');
  });

  it('select() bumps the selection stamp; syncSelection() (from the canvas) does not', () => {
    const { store, root } = setup();
    const s0 = store.getState().selectionStamp;
    store.getState().syncSelection([root], []);
    expect(store.getState()).toMatchObject({ selectedNodeIds: [root], selectionStamp: s0 });
    store.getState().select([], []);
    expect(store.getState().selectionStamp).toBe(s0 + 1);
  });

  it('syncSelection with the same ids keeps the same arrays (no re-render)', () => {
    const { store, root } = setup();
    store.getState().syncSelection([root], []);
    const before = store.getState().selectedNodeIds;
    store.getState().syncSelection([root], []);
    expect(store.getState().selectedNodeIds).toBe(before);
  });

  it('restores collapsed state from localStorage on load, dropping ids of deleted nodes', () => {
    const store = createEditorStore('owner:m1');
    const d = newMapData('Gốc');
    const root = getRoot(d).id;
    saveViewerState('owner:m1', { collapsed: [root, 'deleted-node'] });
    store.getState().load(d, 1, false);
    expect([...store.getState().collapsed]).toEqual([root]);
  });
});

describe('viewer state', () => {
  it('falls back silently when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadViewerState('x')).toEqual({ collapsed: [] });
    spy.mockRestore();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveViewerState('x', { collapsed: [] })).not.toThrow();
    set.mockRestore();
  });

  it('round-trips viewport', () => {
    saveViewerState('k', { viewport: { x: 1, y: 2, zoom: 1.5 }, collapsed: ['a'] });
    expect(loadViewerState('k')).toEqual({ viewport: { x: 1, y: 2, zoom: 1.5 }, collapsed: ['a'] });
  });
});
