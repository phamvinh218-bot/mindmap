import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { MapData } from '@/lib/types';
import { loadViewerState, updateViewerState } from '@/lib/viewerState';

export const HISTORY_LIMIT = 100;

export interface EditorState {
  data: MapData;
  version: number;
  readOnly: boolean;
  dirty: boolean;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  editingNodeId: string | null;
  collapsed: Set<string>;
  past: MapData[];
  future: MapData[];
  load(data: MapData, version: number, readOnly: boolean): void;
  apply(fn: (d: MapData) => MapData): void;
  undo(): void;
  redo(): void;
  markSaved(version: number, savedData: MapData): void;
  select(nodeIds: string[], edgeIds?: string[]): void;
  setEditing(id: string | null): void;
  toggleCollapsed(id: string): void;
  setCollapsed(ids: string[]): void;
}

export type EditorStore = UseBoundStore<StoreApi<EditorState>>;

export function createEditorStore(mapKey: string): EditorStore {
  const persistCollapsed = (s: Set<string>) => updateViewerState(mapKey, { collapsed: [...s] });

  return create<EditorState>()((set, get) => ({
    data: { nodes: [], edges: [] },
    version: 0,
    readOnly: true,
    dirty: false,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    editingNodeId: null,
    collapsed: new Set(),
    past: [],
    future: [],

    load(data, version, readOnly) {
      // Drop collapsed ids of nodes that no longer exist.
      const ids = new Set(data.nodes.map((n) => n.id));
      const collapsed = new Set(loadViewerState(mapKey).collapsed.filter((id) => ids.has(id)));
      set({
        data, version, readOnly, dirty: false, past: [], future: [],
        selectedNodeIds: [], selectedEdgeIds: [], editingNodeId: null, collapsed,
      });
    },

    apply(fn) {
      const s = get();
      if (s.readOnly) return;
      const next = fn(s.data);
      if (next === s.data) return;
      const past = [...s.past, s.data];
      if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
      const alive = new Set(next.nodes.map((n) => n.id));
      const aliveEdges = new Set(next.edges.map((e) => e.id));
      set({
        data: next, past, future: [], dirty: true,
        selectedNodeIds: s.selectedNodeIds.filter((id) => alive.has(id)),
        selectedEdgeIds: s.selectedEdgeIds.filter((id) => aliveEdges.has(id)),
        editingNodeId: s.editingNodeId && alive.has(s.editingNodeId) ? s.editingNodeId : null,
      });
    },

    undo() {
      const s = get();
      if (s.readOnly || s.past.length === 0) return;
      const prev = s.past[s.past.length - 1];
      set({ data: prev, past: s.past.slice(0, -1), future: [s.data, ...s.future], dirty: true, editingNodeId: null });
    },

    redo() {
      const s = get();
      if (s.readOnly || s.future.length === 0) return;
      const [next, ...rest] = s.future;
      set({ data: next, past: [...s.past, s.data], future: rest, dirty: true, editingNodeId: null });
    },

    markSaved(version, savedData) {
      set({ version, dirty: get().data !== savedData });
    },

    select(nodeIds, edgeIds = []) {
      set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds });
    },

    setEditing(id) {
      if (get().readOnly && id !== null) return;
      set({ editingNodeId: id });
    },

    toggleCollapsed(id) {
      const next = new Set(get().collapsed);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistCollapsed(next);
      set({ collapsed: next });
    },

    setCollapsed(ids) {
      const next = new Set(ids);
      persistCollapsed(next);
      set({ collapsed: next });
    },
  }));
}
