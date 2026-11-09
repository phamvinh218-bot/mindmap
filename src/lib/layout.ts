import type { MapData, MindNode, Side } from './types';

export const H_GAP = 220;
export const V_GAP = 56;

function kidsOf(d: MapData, id: string): MindNode[] {
  return d.nodes.filter((n) => n.parentId === id).sort((a, b) => a.y - b.y);
}

/** Where a new child of `parentId` goes: next to the parent, below its lowest sibling. */
export function placeNewChild(d: MapData, parentId: string): { x: number; y: number; side: Side } {
  const parent = d.nodes.find((n) => n.id === parentId);
  if (!parent) return { x: 0, y: 0, side: 'right' };
  let side: Side;
  let siblings: MindNode[];
  if (parent.parentId === null) {
    const kids = kidsOf(d, parentId);
    const right = kids.filter((k) => k.side !== 'left');
    const left = kids.filter((k) => k.side === 'left');
    side = left.length < right.length ? 'left' : 'right';
    siblings = side === 'left' ? left : right;
  } else {
    side = parent.side ?? 'right';
    siblings = kidsOf(d, parentId);
  }
  const x = parent.x + (side === 'left' ? -H_GAP : H_GAP);
  const y = siblings.length ? Math.max(...siblings.map((s) => s.y)) + V_GAP : parent.y;
  return { x, y, side };
}

/**
 * Rebuilds every position as a two-sided tree around the root (root stays put).
 * Each leaf takes one V_GAP row; parents are centered on their children.
 */
export function tidyLayout(d: MapData): MapData {
  const root = d.nodes.find((n) => n.parentId === null);
  if (!root) return d;
  const kids = new Map<string, MindNode[]>();
  for (const n of d.nodes) {
    if (n.parentId === null) continue;
    const list = kids.get(n.parentId) ?? [];
    list.push(n);
    kids.set(n.parentId, list);
  }
  for (const list of kids.values()) list.sort((a, b) => a.y - b.y);

  const height = new Map<string, number>();
  const measure = (n: MindNode): number => {
    const ks = kids.get(n.id) ?? [];
    const h = ks.length ? ks.reduce((s, k) => s + measure(k), 0) : V_GAP;
    height.set(n.id, h);
    return h;
  };

  const pos = new Map<string, { x: number; y: number; side?: Side }>();
  pos.set(root.id, { x: root.x, y: root.y, side: root.side });

  /** Lays out `n` inside the band starting at `top`; returns the node's y. */
  const place = (n: MindNode, depth: number, top: number, side: Side): number => {
    const ks = kids.get(n.id) ?? [];
    const x = root.x + (side === 'left' ? -1 : 1) * depth * H_GAP;
    let y: number;
    if (ks.length === 0) {
      y = top + V_GAP / 2;
    } else {
      let t = top;
      const ys = ks.map((k) => {
        const ky = place(k, depth + 1, t, side);
        t += height.get(k.id)!;
        return ky;
      });
      y = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    pos.set(n.id, { x, y, side });
    return y;
  };

  const rootKids = kids.get(root.id) ?? [];
  for (const side of ['right', 'left'] as const) {
    const group = rootKids.filter((k) => (k.side === 'left' ? 'left' : 'right') === side);
    const total = group.reduce((s, k) => s + measure(k), 0);
    let top = root.y - total / 2;
    for (const k of group) {
      place(k, 1, top, side);
      top += height.get(k.id)!;
    }
  }

  return {
    ...d,
    nodes: d.nodes.map((n) => {
      const p = pos.get(n.id);
      return p ? { ...n, x: p.x, y: p.y, ...(n.parentId === null ? {} : { side: p.side }) } : n;
    }),
  };
}
