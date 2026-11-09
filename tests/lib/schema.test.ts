import { describe, it, expect } from 'vitest';
import { validateMapData } from '@/lib/schema';
import { newMapData } from '@/lib/db/repo';
import type { MapData } from '@/lib/types';

const base = (): MapData => newMapData('Dự án A');
const node = (id: string, parentId: string | null, extra: Record<string, unknown> = {}) => ({
  id, parentId, text: id, color: '#336699', shape: 'rounded', x: 0, y: 0, ...extra,
});

describe('validateMapData', () => {
  it('accepts a fresh map', () => {
    const r = validateMapData(base());
    expect(r.ok).toBe(true);
  });

  it('fresh map has one root with the given text', () => {
    const d = base();
    expect(d.nodes).toHaveLength(1);
    expect(d.nodes[0]).toMatchObject({ parentId: null, text: 'Dự án A', shape: 'rounded', x: 0, y: 0 });
    expect(d.edges).toEqual([]);
  });

  it('rejects two roots', () => {
    const d = { nodes: [node('a', null), node('b', null)], edges: [] };
    expect(validateMapData(d)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects a missing parent', () => {
    const d = { nodes: [node('a', null), node('b', 'zzz')], edges: [] };
    expect(validateMapData(d)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects a parent cycle', () => {
    const d = { nodes: [node('r', null), node('a', 'b'), node('b', 'a')], edges: [] };
    expect(validateMapData(d)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects a connection to a missing node', () => {
    const d = { nodes: [node('r', null)], edges: [{ id: 'e', from: 'r', to: 'nope', color: '#000' }] };
    expect(validateMapData(d)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects an unknown shape', () => {
    const d = { nodes: [node('r', null, { shape: 'star' })], edges: [] };
    expect(validateMapData(d)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects payloads over 2 MB', () => {
    const d = { nodes: [node('r', null, { text: 'x'.repeat(2 * 1024 * 1024 + 10) })], edges: [] };
    expect(validateMapData(d)).toEqual({ ok: false, error: 'too_large' });
  });
});
