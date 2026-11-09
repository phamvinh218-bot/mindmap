'use client';

import { useMemo } from 'react';
import { Editor } from '@/editor/Editor';
import { shareApi } from '@/editor/api';
import type { MapData } from '@/lib/types';

export function PartnerEditor({
  token,
  map,
  mode,
}: {
  token: string;
  map: { title: string; data: MapData; version: number };
  mode: 'edit' | 'view';
}) {
  const api = useMemo(() => shareApi(token), [token]);
  return (
    <Editor
      mapKey={`share:${token}`}
      initial={map}
      mode={mode}
      api={api}
      onReauth={() => window.location.reload()}
    />
  );
}
