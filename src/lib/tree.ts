import { newNodeId } from './db/repo';
import { placeNewChild } from './layout';
import { DEFAULT_CONNECTION_COLOR, PALETTE, type Connection, type MapData, type MindNode, type Side } from './types';

export const NEW_NODE_TEXT = 'Ý mới';

export function getRoot(d: MapData): MindNode {
  const r = d.nodes.find((n) => n.parentId === null);
  if (!r) throw new Error('map has no root');
  return r;
}

export function getNode(d: MapData, id: string): MindNode | undefined {
  return d.nodes.find((n) => n.id === id);
}

/** Direct children, ordered top to bottom. */
export function childrenOf(d: MapData, id: string): MindNode[] {
  return d.nodes.filter((n) => n.parentId === id).sort((a, b) => a.y - b.y);
}

export function descendantIds(d: MapData, id: string): Set<string> {
  const kids = new Map<string, string[]>();
  for (const n of d.nodes) {
    if (n.parentId === null) continue;
    const list = kids.get(n.parentId) ?? [];
    list.push(n.id);
    kids.set(n.parentId, list);
  }
  const out = new Set<string>();
  const stack = [...(kids.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    stack.push(...(kids.get(cur) ?? []));
  }
  return out;
}

export function displayText(n: MindNode): string {
  return n.text.trim() || NEW_NODE_TEXT;
}

export function addChild(d: MapData, parentId: string): { data: MapData; id: string } {
  const parent = getNode(d, parentId);
  if (!parent) return { data: d, id: '' };
  const pos = placeNewChild(d, parentId);
  const color =
    parent.parentId === null ? PALETTE[d.nodes.filter((n) => n.parentId === parentId).length % PALETTE.length] : parent.color;
  const node: MindNode = { id: newNodeId(), parentId, text: '', color, shape: 'rounded', x: pos.x, y: pos.y, side: pos.side };
  return { data: { ...d, nodes: [...d.nodes, node] }, id: node.id };
}

export function addSibling(d: MapData, nodeId: string): { data: MapData; id: string } {
  const n = getNode(d, nodeId);
  if (!n) return { data: d, id: '' };
  return addChild(d, n.parentId ?? n.id);
}

export function deleteNodes(d: MapData, ids: string[]): MapData {
  const doomed = new Set<string>();
  for (const id of ids) {
    const n = getNode(d, id);
    if (!n || n.parentId === null) continue;
    doomed.add(id);
    for (const x of descendantIds(d, id)) doomed.add(x);
  }
  if (doomed.size === 0) return d;
  return {
    nodes: d.nodes.filter((n) => !doomed.has(n.id)),
    edges: d.edges.filter((e) => !doomed.has(e.from) && !doomed.has(e.to)),
  };
}

export function reparent(d: MapData, nodeId: string, newParentId: string): MapData {
  const n = getNode(d, nodeId);
  const p = getNode(d, newParentId);
  if (!n || !p || n.parentId === null || nodeId === newParentId || n.parentId === newParentId) return d;
  const sub = descendantIds(d, nodeId);
  if (sub.has(newParentId)) return d;
  // Under root the node keeps the side it is dropped on; elsewhere it inherits the parent's side.
  const side: Side | undefined =
    p.parentId === null ? (n.x < p.x ? 'left' : 'right') : p.side;
  return {
    ...d,
    nodes: d.nodes.map((x) => {
      if (x.id === nodeId) return { ...x, parentId: newParentId, side };
      if (sub.has(x.id)) return { ...x, side };
      return x;
    }),
  };
}

export function moveSubtree(d: MapData, nodeId: string, dx: number, dy: number): MapData {
  if (dx === 0 && dy === 0) return d;
  const ids = descendantIds(d, nodeId);
  ids.add(nodeId);
  return { ...d, nodes: d.nodes.map((n) => (ids.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) };
}

export function updateNodes(
  d: MapData,
  ids: string[],
  patch: Partial<Pick<MindNode, 'text' | 'color' | 'shape' | 'linkMapId'>>,
  opts: { includeDescendants?: boolean } = {},
): MapData {
  const target = new Set(ids);
  if (opts.includeDescendants) for (const id of ids) for (const x of descendantIds(d, id)) target.add(x);
  return { ...d, nodes: d.nodes.map((n) => (target.has(n.id) ? { ...n, ...patch } : n)) };
}

export function addConnection(d: MapData, from: string, to: string): { data: MapData; id: string } | null {
  if (from === to || !getNode(d, from) || !getNode(d, to)) return null;
  if (d.edges.some((e) => e.from === from && e.to === to)) return null;
  const edge: Connection = { id: newNodeId(), from, to, color: DEFAULT_CONNECTION_COLOR, control: null };
  return { data: { ...d, edges: [...d.edges, edge] }, id: edge.id };
}

export function updateConnection(
  d: MapData,
  id: string,
  patch: Partial<Pick<Connection, 'color' | 'control'>>,
): MapData {
  return { ...d, edges: d.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

export function deleteConnections(d: MapData, ids: string[]): MapData {
  const s = new Set(ids);
  return { ...d, edges: d.edges.filter((e) => !s.has(e.id)) };
}
