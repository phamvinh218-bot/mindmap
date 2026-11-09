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

/** 10 mid-tone colors that stay readable on both light and dark canvases. */
export const PALETTE: readonly string[] = [
  '#2f6fdf', // blue
  '#d9480f', // orange
  '#2b8a3e', // green
  '#ae3ec9', // purple
  '#c92a2a', // red
  '#0c8599', // teal
  '#e67700', // amber
  '#5f3dc4', // violet
  '#a61e4d', // raspberry
  '#5c7080', // slate
];

export const DEFAULT_CONNECTION_COLOR = '#8a8f98';
