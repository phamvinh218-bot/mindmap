export type Shape = 'rect' | 'rounded' | 'pill' | 'ellipse' | 'underline';
export const SHAPES: readonly Shape[] = ['rect', 'rounded', 'pill', 'ellipse', 'underline'];
export type Side = 'left' | 'right';
export type Permission = 'view' | 'edit';

export interface MindNode {
  id: string;
  parentId: string | null;
  text: string;
  color: string;
  shape: Shape;
  x: number;
  y: number;
  /** Set on children of root; descendants inherit. */
  side?: Side;
  linkMapId?: string | null;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  color: string;
  control?: { x: number; y: number } | null;
}

export interface MapData {
  nodes: MindNode[];
  edges: Connection[];
}

/** 10 bright, modern colors (minimal style) that stay readable as fills and outlines on white. */
export const PALETTE: readonly string[] = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#ec4899', // pink
  '#64748b', // slate
];

export const DEFAULT_CONNECTION_COLOR = '#a1a1aa';
