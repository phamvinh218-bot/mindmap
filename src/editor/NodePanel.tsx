'use client';

import { useState } from 'react';
import { PALETTE, SHAPES, type Connection, type MindNode, type Shape } from '@/lib/types';

export type EditorMode = 'owner' | 'edit' | 'view';

const SHAPE_LABEL: Record<Shape, string> = {
  rect: 'Hình chữ nhật',
  rounded: 'Hình bo góc',
  pill: 'Hình viên thuốc',
  ellipse: 'Hình elip',
  underline: 'Chỉ chữ có gạch chân',
};

function ShapeIcon({ shape }: { shape: Shape }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 };
  switch (shape) {
    case 'rect':
      return <rect x="3" y="6" width="18" height="12" {...common} />;
    case 'rounded':
      return <rect x="3" y="6" width="18" height="12" rx="3.5" {...common} />;
    case 'pill':
      return <rect x="3" y="6" width="18" height="12" rx="6" {...common} />;
    case 'ellipse':
      return <ellipse cx="12" cy="12" rx="9" ry="6" {...common} />;
    case 'underline':
      return <line x1="3" y1="17" x2="21" y2="17" {...common} strokeWidth={2.2} />;
  }
}

function Swatches({ value, onPick }: { value?: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Màu ${c}`}
          className={`h-6 w-6 rounded-full border-2 ${value === c ? 'border-fg' : 'border-transparent'}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
        />
      ))}
      <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-border" title="Màu khác">
        <span className="absolute inset-0" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
        <input
          type="color"
          aria-label="Màu khác"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(e) => onPick(e.target.value)}
        />
      </label>
    </div>
  );
}

export function NodePanel({
  nodes,
  edge,
  mode,
  maps,
  currentMapId,
  onNodesPatch,
  onEdgePatch,
  onDeleteEdge,
}: {
  nodes: MindNode[];
  edge: Connection | null;
  mode: EditorMode;
  /** Owner only: maps available as link targets. */
  maps: { id: string; title: string }[];
  currentMapId: string | null;
  onNodesPatch: (patch: Partial<Pick<MindNode, 'color' | 'shape' | 'linkMapId'>>, includeDescendants: boolean) => void;
  onEdgePatch: (patch: { color: string }) => void;
  onDeleteEdge: () => void;
}) {
  const [subtree, setSubtree] = useState(false);
  if (mode === 'view') return null;

  if (edge && nodes.length === 0) {
    return (
      <div className="mm-panel">
        <div className="mm-panel-label">Màu đường nối</div>
        <Swatches value={edge.color} onPick={(c) => onEdgePatch({ color: c })} />
        <button type="button" className="btn btn-danger mt-3 w-full" onClick={onDeleteEdge}>
          Xóa đường nối
        </button>
      </div>
    );
  }
  if (nodes.length === 0) return null;

  const first = nodes[0];
  const single = nodes.length === 1 ? first : null;
  const linkId = single?.linkMapId ?? null;
  const linkTitle = linkId ? maps.find((m) => m.id === linkId)?.title ?? null : null;

  return (
    <div className="mm-panel">
      <div className="mm-panel-label">Màu{nodes.length > 1 ? ` (${nodes.length} ý)` : ''}</div>
      <Swatches value={nodes.every((n) => n.color === first.color) ? first.color : undefined} onPick={(c) => onNodesPatch({ color: c }, subtree)} />
      <label className="mt-2 flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={subtree} onChange={(e) => setSubtree(e.target.checked)} />
        Áp cho nhánh con
      </label>

      <div className="mm-panel-label mt-3">Hình dạng</div>
      <div className="flex gap-1">
        {SHAPES.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={SHAPE_LABEL[s]}
            title={SHAPE_LABEL[s]}
            className={`btn h-8 w-9 px-0 ${nodes.every((n) => n.shape === s) ? 'border-accent text-accent' : ''}`}
            onClick={() => onNodesPatch({ shape: s }, subtree)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <ShapeIcon shape={s} />
            </svg>
          </button>
        ))}
      </div>

      {mode === 'owner' && single && (
        <>
          <label className="mm-panel-label mt-3 block" htmlFor="mm-link">
            Link tới mindmap
          </label>
          {linkId && !linkTitle ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2 py-1.5 text-xs">
              <span className="text-danger">mindmap không còn tồn tại</span>
              <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => onNodesPatch({ linkMapId: null }, false)}>
                Gỡ link
              </button>
            </div>
          ) : (
            <select
              id="mm-link"
              aria-label="Link tới mindmap"
              className="input py-1.5"
              value={linkId ?? ''}
              onChange={(e) => onNodesPatch({ linkMapId: e.target.value || null }, false)}
            >
              <option value="">— Không link —</option>
              {maps
                .filter((m) => m.id !== currentMapId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
            </select>
          )}
        </>
      )}
    </div>
  );
}
