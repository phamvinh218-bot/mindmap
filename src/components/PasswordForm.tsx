'use client';

import { useState, type FormEvent } from 'react';

const MESSAGES: Record<string, string> = {
  wrong_password: 'Sai mật khẩu',
  locked: 'Nhập sai quá nhiều lần, thử lại sau 15 phút',
};

/** One password field that POSTs {password} to `endpoint` and calls onSuccess on 200. */
export function PasswordForm({
  title,
  subtitle,
  endpoint,
  onSuccess,
}: {
  title: string;
  subtitle?: string;
  endpoint: string;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) return onSuccess();
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(MESSAGES[body.error ?? ''] ?? 'Không mở được, thử lại sau');
    } catch {
      setError('Mất kết nối mạng, thử lại sau');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <label className="mt-5 block text-sm font-medium" htmlFor="pw">
          Mật khẩu
        </label>
        <input
          id="pw"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="input mt-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-5 w-full py-2" disabled={busy || !password}>
          {busy ? 'Đang mở…' : 'Mở'}
        </button>
      </form>
    </main>
  );
}
