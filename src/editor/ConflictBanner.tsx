'use client';

import { useState } from 'react';
import type { SaveStatus } from './useAutosave';
import type { EditorMode } from './NodePanel';

export const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Đã lưu',
  saving: 'Đang lưu…',
  dirty: 'Chưa lưu',
  error: 'Lỗi lưu – đang thử lại',
  conflict: 'Chưa lưu',
  expired: 'Phiên đã hết hạn',
  forbidden: 'Không còn quyền sửa',
  invalid: 'Không lưu được',
  gone: 'Mindmap đã bị xóa',
};

export function StatusLabel({ status }: { status: SaveStatus }) {
  const tone = status === 'saved' ? 'text-muted' : status === 'saving' || status === 'dirty' ? 'text-muted' : 'text-danger';
  return <span className={tone}>{STATUS_LABEL[status]}</span>;
}

export function ConflictBanner({
  status,
  mode,
  onReload,
  onSaveCopy,
  onDownload,
  onReauth,
  onRetry,
}: {
  status: SaveStatus;
  mode: EditorMode;
  onReload: () => Promise<void>;
  onSaveCopy?: () => Promise<void>;
  onDownload: () => void;
  onReauth: () => void;
  onRetry: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  let message: string | null = null;
  if (status === 'conflict') message = 'Có người vừa lưu phiên bản mới hơn. Phần bạn đang sửa chưa được lưu.';
  else if (status === 'expired') message = 'Phiên đã hết hạn. Tải phần đang sửa về máy trước khi mở lại.';
  else if (status === 'forbidden') message = 'Bạn không còn quyền sửa mindmap này. Phần đang sửa chưa được lưu.';
  else if (status === 'invalid') message = 'Không lưu được: mindmap quá lớn hoặc dữ liệu lỗi.';
  else if (status === 'gone') message = 'Mindmap này đã bị xóa. Phần đang sửa chưa được lưu.';
  if (!message) return null;

  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 px-3 py-2 text-sm">
      <span className="font-medium text-danger">{message}</span>
      <div className="ml-auto flex flex-wrap gap-1.5">
        {(status === 'conflict' || status === 'forbidden') && (
          <button type="button" className="btn" disabled={busy} onClick={run(onReload)}>
            Tải bản mới
          </button>
        )}
        {(status === 'conflict' || status === 'gone') && mode === 'owner' && onSaveCopy && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={run(onSaveCopy)}>
            Lưu bản của tôi thành bản sao
          </button>
        )}
        <button type="button" className="btn" onClick={onDownload}>
          Tải JSON
        </button>
        {status === 'expired' && (
          <button type="button" className="btn btn-primary" onClick={onReauth}>
            {mode === 'owner' ? 'Đăng nhập lại' : 'Nhập lại mật khẩu'}
          </button>
        )}
        {status === 'expired' && mode === 'owner' && (
          <button type="button" className="btn" onClick={onRetry}>
            Thử lưu lại
          </button>
        )}
      </div>
    </div>
  );
}
