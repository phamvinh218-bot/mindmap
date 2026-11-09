import { nanoid } from 'nanoid';
import { PALETTE, type MapData, type Permission } from '../types';

export interface MapRow {
  id: string;
  title: string;
  data: MapData;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ShareRow {
  id: string;
  map_id: string;
  token: string;
  label: string | null;
  permission: Permission;
  password_hash: string;
  enabled: boolean;
  session_version: number;
  created_at: string;
  last_used_at: string | null;
}

export type MapSummary = Pick<MapRow, 'id' | 'title' | 'updated_at'>;

export type RepoSaveResult =
  | { ok: true; version: number }
  | { ok: false; reason: 'conflict'; version: number }
  | { ok: false; reason: 'not_found' };

export type NewShare = Omit<ShareRow, 'id' | 'created_at' | 'last_used_at' | 'session_version' | 'enabled'>;
export type SharePatch = Partial<
  Pick<ShareRow, 'label' | 'permission' | 'password_hash' | 'enabled' | 'session_version' | 'last_used_at'>
>;

export interface Repo {
  listMaps(): Promise<MapSummary[]>;
  getMap(id: string): Promise<MapRow | null>;
  createMap(title: string, data: MapData): Promise<MapRow>;
  renameMap(id: string, title: string): Promise<boolean>;
  /** Cascades to shares. */
  deleteMap(id: string): Promise<boolean>;
  saveMapData(id: string, data: MapData, expectedVersion: number): Promise<RepoSaveResult>;
  listShares(mapId: string): Promise<ShareRow[]>;
  getShareByToken(token: string): Promise<ShareRow | null>;
  getShare(id: string): Promise<ShareRow | null>;
  createShare(row: NewShare): Promise<ShareRow>;
  updateShare(id: string, patch: SharePatch): Promise<ShareRow | null>;
  deleteShare(id: string): Promise<boolean>;
  countRecentFailures(key: string, sinceIso: string): Promise<number>;
  recordFailure(key: string): Promise<void>;
  purgeAttemptsBefore(iso: string): Promise<void>;
  ping(): Promise<void>;
}

export function newNodeId(): string {
  return nanoid(10);
}

export function newMapData(rootText: string): MapData {
  return {
    nodes: [{ id: newNodeId(), parentId: null, text: rootText, color: PALETTE[0], shape: 'rounded', x: 0, y: 0 }],
    edges: [],
  };
}
