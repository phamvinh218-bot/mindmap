import { z } from 'zod';
import { SHAPES, type MapData, type MindNode } from './types';

export const MAX_DATA_BYTES = 2 * 1024 * 1024;

const point = z.object({ x: z.number().finite(), y: z.number().finite() });

export const mindNodeSchema = z.object({
  id: z.string().min(1).max(64),
  parentId: z.string().min(1).max(64).nullable(),
  text: z.string(),
  color: z.string().max(32),
  shape: z.enum(SHAPES as [string, ...string[]]),
  x: z.number().finite(),
  y: z.number().finite(),
  side: z.enum(['left', 'right']).optional(),
  linkMapId: z.string().max(64).nullable().optional(),
});

export const connectionSchema = z.object({
  id: z.string().min(1).max(64),
  from: z.string().min(1),
  to: z.string().min(1),
  color: z.string().max(32),
  control: point.nullable().optional(),
});

export const mapDataSchema = z.object({
  nodes: z.array(mindNodeSchema).min(1),
  edges: z.array(connectionSchema),
});

function isValidTree(d: MapData): boolean {
  const byId = new Map<string, MindNode>(d.nodes.map((n) => [n.id, n]));
  if (byId.size !== d.nodes.length) return false;
  if (d.nodes.filter((n) => n.parentId === null).length !== 1) return false;
  for (const n of d.nodes) {
    // Walk up to the root; a missing parent or a revisit means invalid.
    const seen = new Set<string>();
    let cur: MindNode | undefined = n;
    while (cur && cur.parentId !== null) {
      if (seen.has(cur.id)) return false;
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
      if (!cur) return false;
    }
  }
  return d.edges.every((e) => byId.has(e.from) && byId.has(e.to));
}

export function validateMapData(
  input: unknown,
): { ok: true; data: MapData } | { ok: false; error: 'invalid' | 'too_large' } {
  let size: number;
  try {
    size = JSON.stringify(input)?.length ?? 0;
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (size > MAX_DATA_BYTES) return { ok: false, error: 'too_large' };
  const parsed = mapDataSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const data = parsed.data as MapData;
  if (!isValidTree(data)) return { ok: false, error: 'invalid' };
  return { ok: true, data };
}
