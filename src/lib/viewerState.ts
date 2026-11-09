/** Per-viewer, per-map UI state (viewport, collapsed branches). Never part of the shared map. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}
export interface ViewerState {
  viewport?: Viewport;
  collapsed: string[];
}

const keyOf = (mapKey: string) => `mm:view:${mapKey}`;

export function loadViewerState(mapKey: string): ViewerState {
  try {
    const raw = localStorage.getItem(keyOf(mapKey));
    if (!raw) return { collapsed: [] };
    const v = JSON.parse(raw) as Partial<ViewerState>;
    const out: ViewerState = { collapsed: Array.isArray(v.collapsed) ? v.collapsed.filter((x) => typeof x === 'string') : [] };
    const vp = v.viewport;
    if (vp && [vp.x, vp.y, vp.zoom].every((n) => typeof n === 'number' && Number.isFinite(n))) out.viewport = vp;
    return out;
  } catch {
    return { collapsed: [] };
  }
}

export function saveViewerState(mapKey: string, s: ViewerState): void {
  try {
    localStorage.setItem(keyOf(mapKey), JSON.stringify(s));
  } catch {
    // storage blocked or full: viewer state is a convenience only
  }
}

export function updateViewerState(mapKey: string, patch: Partial<ViewerState>): void {
  saveViewerState(mapKey, { ...loadViewerState(mapKey), ...patch });
}
