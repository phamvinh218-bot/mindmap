'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Permission } from '@/lib/types';

export interface ShareInfo {
  id: string;
  label: string | null;
  permission: Permission;
  enabled: boolean;
  url: string;
  created_at: string;
  last_used_at: string | null;
}

const MIN_PW = 4;

async function send(url: string, method: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-1.5">
      <input readOnly className="input py-1 text-xs" value={value} onFocus={(e) => e.target.select()} aria-label="Link chia sẻ" />
      <button
        type="button"
        className="btn shrink-0 px-2 py-1 text-xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard blocked: the field is selectable as a fallback
          }
        }}
      >
        {copied ? 'Đã chép' : 'Sao chép'}
      </button>
    </div>
  );
}

function ShareRowView({ share, onChange, onDelete }: { share: ShareInfo; onChange: (s: ShareInfo) => void; onDelete: () => void }) {
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setError(null);
    const res = await send(`/api/shares/${share.id}`, 'PATCH', body).catch(() => null);
    if (!res?.ok) return setError('Không cập nhật được');
    onChange((await res.json()) as ShareInfo);
  };

  return (
    <li className={`rounded-xl border border-border p-3 ${share.enabled ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto truncate text-sm font-medium">{share.label || 'Link không tên'}</span>
        <select
          aria-label={`Quyền của ${share.label || 'link'}`}
          className="input w-auto py-1 text-xs"
          value={share.permission}
          onChange={(e) => void patch({ permission: e.target.value })}
        >
          <option value="view">Chỉ xem</option>
          <option value="edit">Được sửa</option>
        </select>
        <button type="button" className="btn px-2 py-1 text-xs" onClick={() => void patch({ enabled: !share.enabled })}>
          {share.enabled ? 'Tắt' : 'Bật'}
        </button>
      </div>
      <div className="mt-2">
        <CopyField value={share.url} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="mr-auto text-muted">
          {share.last_used_at ? `Mở lần cuối ${new Date(share.last_used_at).toLocaleString('vi-VN')}` : 'Chưa ai mở'}
        </span>
        <button type="button" className="text-accent hover:underline" onClick={() => setPwOpen((o) => !o)}>
          Đổi mật khẩu
        </button>
        <button
          type="button"
          className="text-danger hover:underline"
          onClick={() => {
            if (window.confirm('Xóa link này? Người đang dùng link sẽ mất quyền truy cập.')) onDelete();
          }}
        >
          Xóa
        </button>
      </div>
      {pwOpen && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.length < MIN_PW) return;
            await patch({ password: pw });
            setPw('');
            setPwOpen(false);
          }}
        >
          <input
            type="password"
            className="input py-1 text-xs"
            placeholder="Mật khẩu mới (ít nhất 4 ký tự)"
            aria-label="Mật khẩu mới"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
          />
          <button type="submit" className="btn shrink-0 px-2 py-1 text-xs" disabled={pw.length < MIN_PW}>
            Lưu
          </button>
        </form>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </li>
  );
}

export function ShareDialog({ mapId, onClose }: { mapId: string; onClose: () => void }) {
  const [shares, setShares] = useState<ShareInfo[] | null>(null);
  const [label, setLabel] = useState('');
  const [permission, setPermission] = useState<Permission>('edit');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/maps/${mapId}/shares`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<ShareInfo[]>) : []))
      .then((list) => alive && setShares(list))
      .catch(() => alive && setShares([]));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [mapId, onClose]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PW || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await send(`/api/maps/${mapId}/shares`, 'POST', { label, permission, password });
      if (!res.ok) throw new Error();
      const created = (await res.json()) as ShareInfo;
      setShares((s) => [...(s ?? []), created]);
      setLabel('');
      setPassword('');
    } catch {
      setError('Không tạo được link, thử lại sau');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Chia sẻ mindmap"
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <h2 className="mr-auto text-base font-semibold">Chia sẻ mindmap</h2>
          <button type="button" className="btn px-2" aria-label="Đóng" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          Mỗi link có mật khẩu riêng. Người nhận mở link, nhập mật khẩu là xem hoặc sửa được, không cần tài khoản.
        </p>

        <form onSubmit={create} className="mt-4 grid gap-2 rounded-xl bg-surface-2 p-3 sm:grid-cols-2">
          <label className="text-xs font-medium sm:col-span-2">
            Tên gợi nhớ (tùy chọn)
            <input className="input mt-1" placeholder="Ví dụ: Partner Minh" value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="text-xs font-medium" htmlFor="share-perm">
            Quyền
            <select id="share-perm" aria-label="Quyền" className="input mt-1" value={permission} onChange={(e) => setPermission(e.target.value as Permission)}>
              <option value="edit">Được sửa</option>
              <option value="view">Chỉ xem</option>
            </select>
          </label>
          <label className="text-xs font-medium" htmlFor="share-pw">
            Mật khẩu cho link
            <input
              id="share-pw"
              aria-label="Mật khẩu cho link"
              type="password"
              autoComplete="new-password"
              className="input mt-1"
              placeholder="Ít nhất 4 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary w-full" disabled={busy || password.length < MIN_PW}>
              Tạo link
            </button>
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          </div>
        </form>

        <h3 className="mt-5 text-sm font-semibold">Các link đã tạo</h3>
        {shares === null ? (
          <p className="mt-2 text-sm text-muted">Đang tải…</p>
        ) : shares.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Chưa có link nào.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {shares.map((s) => (
              <ShareRowView
                key={s.id}
                share={s}
                onChange={(n) => setShares((list) => (list ?? []).map((x) => (x.id === n.id ? n : x)))}
                onDelete={async () => {
                  const res = await send(`/api/shares/${s.id}`, 'DELETE').catch(() => null);
                  if (res?.ok) setShares((list) => (list ?? []).filter((x) => x.id !== s.id));
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
