'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NameDialog } from '@/components/NameDialog';
import { foldVi, relativeTimeVi } from '@/lib/text';

export interface MapCard {
  id: string;
  title: string;
  updated_at: string;
}

type DialogState = { kind: 'create' } | { kind: 'rename'; map: MapCard } | null;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function CardMenu({
  map,
  onRename,
  onDuplicate,
  onDelete,
}: {
  map: MapCard;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const item = 'block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-2';
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Thao tác"
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn h-8 w-8 px-0"
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
          <button role="menuitem" type="button" className={item} onClick={pick(onRename)}>
            Đổi tên
          </button>
          <button role="menuitem" type="button" className={item} onClick={pick(onDuplicate)}>
            Nhân bản
          </button>
          <Link role="menuitem" className={item} href={`/m/${map.id}?share=1`}>
            Chia sẻ
          </Link>
          <a role="menuitem" className={item} href={`/api/maps/${map.id}/export`} download>
            Xuất JSON
          </a>
          <button role="menuitem" type="button" className={`${item} text-danger`} onClick={pick(onDelete)}>
            Xóa
          </button>
        </div>
      )}
    </div>
  );
}

export function Dashboard({ initialMaps, now }: { initialMaps: MapCard[]; now?: Date }) {
  const router = useRouter();
  const [maps, setMaps] = useState(initialMaps);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const q = foldVi(query.trim());
    return [...maps]
      .filter((m) => !q || foldVi(m.title).includes(q))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [maps, query]);

  const create = async (title: string) => {
    const { id } = await json<{ id: string }>(
      await fetch('/api/maps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }) }),
    );
    router.push(`/m/${id}`);
  };

  const rename = async (map: MapCard, title: string) => {
    const res = await fetch(`/api/maps/${map.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('rename failed');
    setMaps((ms) => ms.map((m) => (m.id === map.id ? { ...m, title, updated_at: new Date().toISOString() } : m)));
    setDialog(null);
  };

  const duplicate = async (map: MapCard) => {
    try {
      await json(await fetch(`/api/maps/${map.id}/duplicate`, { method: 'POST' }));
      router.refresh();
      const list = await json<MapCard[]>(await fetch('/api/maps', { cache: 'no-store' }));
      setMaps(list);
    } catch {
      setError('Không nhân bản được, thử lại sau');
    }
  };

  const remove = async (map: MapCard) => {
    if (!window.confirm('Xóa mindmap này? Không thể hoàn tác.')) return;
    const res = await fetch(`/api/maps/${map.id}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) setMaps((ms) => ms.filter((m) => m.id !== map.id));
    else setError('Không xóa được, thử lại sau');
  };

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { title?: string; data?: unknown };
      const title = (typeof parsed.title === 'string' && parsed.title.trim()) || file.name.replace(/\.json$/i, '');
      const { id } = await json<{ id: string }>(
        await fetch('/api/maps/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, data: parsed.data }),
        }),
      );
      router.push(`/m/${id}`);
    } catch {
      setError('File JSON không hợp lệ');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Mindmap của tôi</h1>
        <input
          type="file"
          accept="application/json,.json"
          hidden
          ref={fileRef}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importFile(f);
          }}
        />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Nhập JSON
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
          + Mindmap mới
        </button>
        <button type="button" className="btn" onClick={logout}>
          Đăng xuất
        </button>
      </header>

      <input
        type="search"
        role="searchbox"
        placeholder="Tìm theo tên…"
        className="input mt-5 max-w-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {maps.length === 0 ? (
        <p className="mt-10 text-center text-muted">Chưa có mindmap nào. Bấm “Mindmap mới” để bắt đầu.</p>
      ) : shown.length === 0 ? (
        <p className="mt-10 text-center text-muted">Không có mindmap nào khớp “{query}”.</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <article key={m.id} className="group relative flex items-start gap-2 rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
              <Link href={`/m/${m.id}`} className="min-w-0 flex-1">
                <h2 className="truncate font-medium">{m.title}</h2>
                <p className="mt-1 text-xs text-muted" suppressHydrationWarning>
                  Sửa {relativeTimeVi(m.updated_at, now)}
                </p>
              </Link>
              <CardMenu
                map={m}
                onRename={() => setDialog({ kind: 'rename', map: m })}
                onDuplicate={() => void duplicate(m)}
                onDelete={() => void remove(m)}
              />
            </article>
          ))}
        </div>
      )}

      {dialog?.kind === 'create' && (
        <NameDialog title="Mindmap mới" submitLabel="Tạo" onSubmit={create} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'rename' && (
        <NameDialog
          title="Đổi tên"
          initial={dialog.map.title}
          submitLabel="Lưu"
          onSubmit={(t) => rename(dialog.map, t)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
