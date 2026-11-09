'use client';

import { useMemo, useState } from 'react';
import { Editor } from '@/editor/Editor';
import { ownerApi } from '@/editor/api';
import type { MapData } from '@/lib/types';

export function OwnerEditor({
  map,
  maps,
  openShare,
}: {
  map: { id: string; title: string; data: MapData; version: number };
  maps: { id: string; title: string }[];
  openShare: boolean;
}) {
  const api = useMemo(() => ownerApi(map.id), [map.id]);
  const [title, setTitle] = useState(map.title);
  const [shareOpen, setShareOpen] = useState(openShare);
  void shareOpen;

  const rename = async (t: string) => {
    const prev = title;
    setTitle(t);
    const res = await fetch(`/api/maps/${map.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: t }),
    }).catch(() => null);
    if (!res?.ok) setTitle(prev);
  };

  return (
    <Editor
      mapKey={`owner:${map.id}`}
      mapId={map.id}
      initial={{ title, data: map.data, version: map.version }}
      mode="owner"
      api={api}
      maps={maps.map((m) => (m.id === map.id ? { ...m, title } : m))}
      onRename={rename}
      onSaveAsCopy={async (data) => {
        const res = await fetch('/api/maps/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: `${title} (bản sao)`.slice(-200), data }),
        });
        if (!res.ok) throw new Error('save copy failed');
        const { id } = (await res.json()) as { id: string };
        return `/m/${id}`;
      }}
      onReauth={() => window.open('/login', '_blank')}
      extra={
        <button type="button" className="btn btn-primary" onClick={() => setShareOpen(true)}>
          Chia sẻ
        </button>
      }
    />
  );
}
