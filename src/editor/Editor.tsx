'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import type { MapData, MindNode } from '@/lib/types';
import {
  addChild, addConnection, addSibling, deleteConnections, deleteNodes, getNode, getRoot, updateConnection, updateNodes,
} from '@/lib/tree';
import { tidyLayout } from '@/lib/layout';
import { createEditorStore, type EditorStore } from './store';
import { Canvas } from './Canvas';
import { NodePanel, type EditorMode } from './NodePanel';
import { TopBar } from './TopBar';
import { isShortcutTarget, keyToCommand } from './keyboard';
import { useToast } from './Toast';
import { confirmLeave, useAutosave } from './useAutosave';
import { ConflictBanner, StatusLabel } from './ConflictBanner';
import type { EditorApi } from './api';
import type { NodeActions } from './MindNodeView';

export interface EditorProps {
  mapKey: string;
  /** Owner mode: the current map id (excluded from the link picker). */
  mapId?: string | null;
  initial: { title: string; data: MapData; version: number };
  mode: EditorMode;
  api: EditorApi;
  /** Owner mode: every map (for link titles and the picker). */
  maps?: { id: string; title: string }[];
  onRename?: (title: string) => void;
  /** Extra top-bar controls (owner: Share button). */
  extra?: ReactNode;
  /** Owner: save the local copy as a new map after a version conflict. */
  onSaveAsCopy?: (data: MapData) => Promise<string>;
  /** Where to send the viewer when the session expired. */
  onReauth?: () => void;
}

function downloadJson(title: string, data: MapData) {
  const blob = new Blob([JSON.stringify({ title, data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]+/g, '-') || 'mindmap'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Inner(props: EditorProps & { store: EditorStore }) {
  const { store, mode, maps = [], mapId = null, api } = props;
  const rf = useReactFlow();
  const router = useRouter();
  const toast = useToast();
  const showToast = toast.show;
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const data = store((s) => s.data);
  const selectedNodeIds = store((s) => s.selectedNodeIds);
  const selectedEdgeIds = store((s) => s.selectedEdgeIds);
  const canUndo = store((s) => s.past.length > 0);
  const canRedo = store((s) => s.future.length > 0);

  const saver = useAutosave(store, api, {});
  const saverRef = useRef(saver);
  useEffect(() => {
    saverRef.current = saver;
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __mmStore?: unknown }).__mmStore = store;
  }, [store]);

  // Keyed by content so a parent passing a fresh array each render does not re-derive every node.
  const mapsKey = JSON.stringify(maps);

  /** Soft navigation skips beforeunload: save first, and ask if edits would be lost. */
  const leave = useCallback(
    async (url: string) => {
      const ok = await confirmLeave(
        () => saverRef.current.flush(),
        () => store.getState().dirty,
        (m) => window.confirm(m),
      );
      if (ok) router.push(url);
    },
    [router, store],
  );
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const titles = useMemo(() => new Map(maps.map((m) => [m.id, m.title])), [mapsKey]);

  const linkInfo = useCallback(
    (n: MindNode) => {
      if (!n.linkMapId) return null;
      if (mode !== 'owner') return { title: null, dead: false };
      const title = titles.get(n.linkMapId) ?? null;
      return { title, dead: title === null };
    },
    [mode, titles],
  );

  /** Pans (without zooming) so the node is inside the visible canvas. */
  const ensureVisible = useCallback(
    (id: string) => {
      const el = wrapRef.current;
      const n = getNode(store.getState().data, id);
      if (!el || !n) return;
      const r = el.getBoundingClientRect();
      const tl = rf.screenToFlowPosition({ x: r.left + 80, y: r.top + 60 });
      const br = rf.screenToFlowPosition({ x: r.right - 300, y: r.bottom - 60 });
      if (n.x > tl.x && n.x < br.x && n.y > tl.y && n.y < br.y) return;
      rf.setCenter(n.x, n.y, { zoom: rf.getZoom(), duration: 250 });
    },
    [rf, store],
  );

  const focusCanvas = () => wrapRef.current?.focus({ preventScroll: true });

  const actions = useMemo<NodeActions>(
    () => ({
      commitText(id, text) {
        const s = store.getState();
        s.setEditing(null);
        const n = getNode(s.data, id);
        if (text !== null && n && n.text !== text) s.apply((d) => updateNodes(d, [id], { text }));
        setTimeout(() => {
          if (!store.getState().editingNodeId) focusCanvas();
        }, 0);
      },
      startEdit(id) {
        const s = store.getState();
        s.select([id]);
        s.setEditing(id);
      },
      takeTypeahead() {
        return store.getState().takeTypeahead();
      },
      toggleCollapse(id) {
        store.getState().toggleCollapsed(id);
      },
      openLink(id) {
        const n = getNode(store.getState().data, id);
        const target = n?.linkMapId;
        if (!target) return;
        if (mode !== 'owner') return showToast('Bạn chưa được chia sẻ mindmap này');
        if (!titles.has(target)) return showToast('mindmap không còn tồn tại');
        void leaveRef.current(`/m/${target}`);
      },
    }),
    [store, mode, titles, router, showToast],
  );

  const onConnectPick = useCallback(
    (targetId: string) => {
      const from = connectFrom;
      setConnectFrom(null);
      if (!from) return;
      store.getState().apply((d) => addConnection(d, from, targetId)?.data ?? d);
    },
    [connectFrom, store],
  );

  const startConnectTool = () => {
    if (connectFrom) return setConnectFrom(null);
    const sel = store.getState().selectedNodeIds[0];
    if (!sel) return toast.show('Chọn một ý trước, rồi bấm Nối');
    setConnectFrom(sel);
    toast.show('Bấm vào ý muốn nối tới (Esc để hủy)');
  };

  const tidy = () => {
    store.getState().apply(tidyLayout);
    setTimeout(() => rf.fitView({ padding: 0.25, maxZoom: 1.2, duration: 300 }), 50);
  };

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connectFrom) {
        setConnectFrom(null);
        return;
      }
      const editing = !isShortcutTarget(e.target);
      const s = store.getState();
      if (s.editingNodeId && !editing) {
        // The new node's text box is still taking focus: keep what the user types.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          s.pushTypeahead(e.key);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          return;
        }
      }
      const cmd = keyToCommand(e, { editing });
      if (!cmd) return;
      if (cmd === 'save') {
        e.preventDefault();
        saverRef.current?.saveNow();
        return;
      }
      if (s.readOnly) return;
      e.preventDefault();
      const sel = s.selectedNodeIds;
      const add = (fn: (d: MapData) => { data: MapData; id: string }) => {
        let newId = '';
        s.apply((d) => {
          const r = fn(d);
          newId = r.id;
          return r.data;
        });
        if (!newId) return;
        const parent = getNode(store.getState().data, newId)?.parentId;
        if (parent && store.getState().collapsed.has(parent)) store.getState().toggleCollapsed(parent);
        store.getState().select([newId]);
        store.getState().setEditing(newId);
        setTimeout(() => ensureVisible(newId), 30);
      };
      switch (cmd) {
        case 'addChild':
          return add((d) => addChild(d, sel[0] ?? getRoot(d).id));
        case 'addSibling':
          return add((d) => addSibling(d, sel[0] ?? getRoot(d).id));
        case 'delete':
          if (sel.length || s.selectedEdgeIds.length) {
            s.apply((d) => deleteConnections(deleteNodes(d, sel), s.selectedEdgeIds));
          }
          return;
        case 'edit':
          if (sel[0]) actions.startEdit(sel[0]);
          return;
        case 'undo':
          return s.undo();
        case 'redo':
          return s.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, connectFrom, actions]);

  const selNodes = useMemo(
    () => selectedNodeIds.map((id) => getNode(data, id)).filter((n): n is MindNode => !!n),
    [selectedNodeIds, data],
  );
  const selEdge = selectedEdgeIds.length === 1 ? data.edges.find((e) => e.id === selectedEdgeIds[0]) ?? null : null;

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        onBack={() => void leave('/')}
        title={props.initial.title}
        mode={mode}
        onRename={props.onRename}
        status={mode === 'view' ? null : <StatusLabel status={saver.status} />}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => store.getState().undo()}
        onRedo={() => store.getState().redo()}
        onTidy={tidy}
        connecting={connectFrom !== null}
        onConnectTool={startConnectTool}
        onFit={() => rf.fitView({ padding: 0.25, maxZoom: 1.2, duration: 300 })}
        extra={props.extra}
      />
      <ConflictBanner
        status={saver.status}
        mode={mode}
        onReload={saver.reloadLatest}
        onSaveCopy={
          props.onSaveAsCopy
            ? async () => {
                const s = store.getState();
                const url = await props.onSaveAsCopy!(s.data);
                s.markSaved(s.version, s.data); // the copy holds these edits now
                window.location.href = url;
              }
            : undefined
        }
        onRetry={saver.retry}
        onDownload={() => downloadJson(props.initial.title, store.getState().data)}
        onReauth={() => (props.onReauth ? props.onReauth() : window.location.reload())}
      />
      <div ref={wrapRef} data-mm-canvas tabIndex={-1} className="relative flex-1 outline-none" style={{ background: 'var(--canvas)' }}>
        <Canvas
          store={store}
          mapKey={props.mapKey}
          linkInfo={linkInfo}
          actions={actions}
          connectFrom={connectFrom}
          onConnectPick={onConnectPick}
        />
        <div className="absolute right-3 top-3 z-10 w-64 max-w-[calc(100%-1.5rem)]">
          <NodePanel
            nodes={selNodes}
            edge={selNodes.length === 0 ? selEdge : null}
            mode={mode}
            maps={maps}
            currentMapId={mapId}
            onNodesPatch={(patch, sub) => store.getState().apply((d) => updateNodes(d, selectedNodeIds, patch, { includeDescendants: sub }))}
            onEdgePatch={(patch) => selEdge && store.getState().apply((d) => updateConnection(d, selEdge.id, patch))}
            onDeleteEdge={() => selEdge && store.getState().apply((d) => deleteConnections(d, [selEdge.id]))}
          />
        </div>
        {mode !== 'view' && (
          <p className="pointer-events-none absolute bottom-2 left-3 hidden text-xs text-muted md:block">
            Tab: thêm ý con · Enter: thêm ý cùng cấp · F2/double-click: sửa · Delete: xóa · Shift+kéo: chọn nhiều
          </p>
        )}
      </div>
      {toast.node}
    </div>
  );
}

export function Editor(props: EditorProps) {
  const [store] = useState(() => {
    const s = createEditorStore(props.mapKey);
    s.getState().load(props.initial.data, props.initial.version, props.mode === 'view');
    return s;
  });
  return (
    <ReactFlowProvider>
      <Inner {...props} store={store} />
    </ReactFlowProvider>
  );
}
