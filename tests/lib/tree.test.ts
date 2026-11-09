import { describe, it, expect } from 'vitest';
import {
  addChild, addSibling, addConnection, deleteNodes, deleteConnections, descendantIds, displayText, getRoot,
  moveSubtree, reparent, updateNodes, updateConnection, childrenOf, NEW_NODE_TEXT,
} from '@/lib/tree';
import { H_GAP, V_GAP, placeNewChild, tidyLayout } from '@/lib/layout';
import { validateMapData } from '@/lib/schema';
import { newMapData } from '@/lib/db/repo';
import { PALETTE, type MapData } from '@/lib/types';

/** root → a → (a1, a2), root → b */
function sample() {
  let d = newMapData('Gốc');
  const root = getRoot(d).id;
  let r = addChild(d, root); d = r.data; const a = r.id;
  r = addChild(d, root); d = r.data; const b = r.id;
  r = addChild(d, a); d = r.data; const a1 = r.id;
  r = addChild(d, a); d = r.data; const a2 = r.id;
  return { d, root, a, b, a1, a2 };
}
const node = (d: MapData, id: string) => d.nodes.find((n) => n.id === id)!;

describe('tree operations', () => {
  it('addChild creates a valid child with the new-node text and rounded shape', () => {
    const { d, a, a1 } = sample();
    expect(node(d, a1)).toMatchObject({ parentId: a, text: '', shape: 'rounded' });
    expect(validateMapData(d).ok).toBe(true);
  });

  it('children of root get palette colors round-robin; deeper nodes inherit the parent color', () => {
    const { d, a, b, a1 } = sample();
    expect(node(d, a).color).toBe(PALETTE[0]);
    expect(node(d, b).color).toBe(PALETTE[1]);
    expect(node(d, a1).color).toBe(node(d, a).color);
  });

  it('does not mutate its input', () => {
    const { d, a } = sample();
    const before = JSON.stringify(d);
    addChild(d, a);
    deleteNodes(d, [a]);
    expect(JSON.stringify(d)).toBe(before);
  });

  it('addSibling adds under the same parent; on root it adds a child', () => {
    const { d, root, a, a1 } = sample();
    const s = addSibling(d, a1);
    expect(node(s.data, s.id).parentId).toBe(a);
    const r = addSibling(d, root);
    expect(node(r.data, r.id).parentId).toBe(root);
  });

  it('deleteNodes ignores the root', () => {
    const { d, root } = sample();
    expect(deleteNodes(d, [root])).toEqual(d);
  });

  it('deleteNodes removes the subtree and every connection touching it', () => {
    const { d, a, b, a2 } = sample();
    const c1 = addConnection(d, a2, b)!;
    const c2 = addConnection(c1.data, b, a)!;
    const out = deleteNodes(c2.data, [a]);
    expect(out.nodes.map((n) => n.id)).not.toContain(a2);
    expect(out.nodes.map((n) => n.id)).not.toContain(a);
    expect(out.edges).toEqual([]);
    expect(validateMapData(out).ok).toBe(true);
  });

  it('descendantIds lists the whole subtree', () => {
    const { d, a, a1, a2 } = sample();
    expect(descendantIds(d, a)).toEqual(new Set([a1, a2]));
  });

  it('reparent into own descendant or self, or of the root, is a no-op', () => {
    const { d, root, a, a1, b } = sample();
    expect(reparent(d, a, a1)).toEqual(d);
    expect(reparent(d, a, a)).toEqual(d);
    expect(reparent(d, root, b)).toEqual(d);
  });

  it('reparent moves the node and gives its subtree the new side', () => {
    const { d, a, b, a1 } = sample();
    expect(node(d, a).side).toBe('right');
    expect(node(d, b).side).toBe('left');
    const out = reparent(d, a1, b);
    expect(node(out, a1)).toMatchObject({ parentId: b, side: 'left' });
    expect(validateMapData(out).ok).toBe(true);
  });

  it('moveSubtree shifts the node and every descendant', () => {
    const { d, a, a1, a2, b } = sample();
    const out = moveSubtree(d, a, 10, -5);
    for (const id of [a, a1, a2]) {
      expect(node(out, id).x).toBe(node(d, id).x + 10);
      expect(node(out, id).y).toBe(node(d, id).y - 5);
    }
    expect(node(out, b)).toEqual(node(d, b));
  });

  it('updateNodes can include descendants', () => {
    const { d, a, a1, a2, b } = sample();
    const sub = updateNodes(d, [a], { color: '#f00' }, { includeDescendants: true });
    expect([a, a1, a2].map((id) => node(sub, id).color)).toEqual(['#f00', '#f00', '#f00']);
    expect(node(sub, b).color).not.toBe('#f00');
    const only = updateNodes(d, [a], { color: '#f00' });
    expect(node(only, a1).color).not.toBe('#f00');
  });

  it('connections: no self-loops, no duplicates, update and delete', () => {
    const { d, a, b } = sample();
    expect(addConnection(d, a, a)).toBeNull();
    const c = addConnection(d, a, b)!;
    expect(addConnection(c.data, a, b)).toBeNull();
    const moved = updateConnection(c.data, c.id, { control: { x: 5, y: 6 }, color: '#123' });
    expect(moved.edges[0]).toMatchObject({ from: a, to: b, control: { x: 5, y: 6 }, color: '#123' });
    expect(deleteConnections(moved, [c.id]).edges).toEqual([]);
  });

  it('displayText falls back to the placeholder for blank text', () => {
    expect(displayText({ ...node(sample().d, sample().root), text: '   ' })).toBe(NEW_NODE_TEXT);
    expect(NEW_NODE_TEXT).toBe('Ý mới');
  });

  it('childrenOf orders by y', () => {
    const { d, a, a1, a2 } = sample();
    expect(childrenOf(d, a).map((n) => n.id)).toEqual([a1, a2]);
  });
});

describe('layout', () => {
  it('alternates root children right, left, right', () => {
    let d = newMapData('Gốc');
    const root = getRoot(d).id;
    const sides: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = addChild(d, root);
      d = r.data;
      sides.push(node(d, r.id).side!);
    }
    expect(sides).toEqual(['right', 'left', 'right']);
  });

  it('places the first child at parent.x ± H_GAP and next siblings V_GAP lower', () => {
    const { d, root, a, b, a1, a2 } = sample();
    expect(node(d, a).x).toBe(node(d, root).x + H_GAP);
    expect(node(d, b).x).toBe(node(d, root).x - H_GAP);
    expect(node(d, a1)).toMatchObject({ x: node(d, a).x + H_GAP, y: node(d, a).y });
    expect(node(d, a2).y).toBe(node(d, a1).y + V_GAP);
    expect(placeNewChild(d, a)).toEqual({ x: node(d, a).x + H_GAP, y: node(d, a2).y + V_GAP, side: 'right' });
  });

  it('tidyLayout produces a balanced, non-overlapping tree', () => {
    let d = newMapData('Gốc');
    const root = getRoot(d).id;
    const lvl1: string[] = [];
    for (let i = 0; i < 4; i++) { const r = addChild(d, root); d = r.data; lvl1.push(r.id); }
    const lvl2: string[] = [];
    for (const p of lvl1) for (let i = 0; i < 2; i++) { const r = addChild(d, p); d = r.data; lvl2.push(r.id); }
    for (let i = 0; i < 3; i++) { const r = addChild(d, lvl2[i]); d = r.data; }
    // scramble positions
    d = { ...d, nodes: d.nodes.map((n, i) => ({ ...n, x: (i * 37) % 11, y: (i * 53) % 7 })) };
    expect(d.nodes).toHaveLength(16);

    const out = tidyLayout(d);
    const rootNode = node(out, root);
    const keys = new Set(out.nodes.map((n) => `${Math.round(n.x)},${Math.round(n.y)}`));
    expect(keys.size).toBe(out.nodes.length);
    for (const n of out.nodes) {
      if (n.side === 'left') expect(n.x).toBeLessThan(rootNode.x);
      if (n.side === 'right') expect(n.x).toBeGreaterThan(rootNode.x);
    }
    for (const n of out.nodes) {
      const kids = out.nodes.filter((k) => k.parentId === n.id);
      if (n.parentId === null || kids.length === 0) continue;
      const ys = kids.map((k) => k.y);
      expect(Math.abs(n.y - (Math.min(...ys) + Math.max(...ys)) / 2)).toBeLessThanOrEqual(1);
    }
    expect(validateMapData(out).ok).toBe(true);
  });
});
