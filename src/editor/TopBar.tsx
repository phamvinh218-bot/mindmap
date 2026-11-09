'use client';

import { useState, type ReactNode } from 'react';
import type { EditorMode } from './NodePanel';

export function TopBar({
  title,
  mode,
  onRename,
  status,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onTidy,
  connecting,
  onConnectTool,
  onFit,
  extra,
  onBack,
}: {
  title: string;
  mode: EditorMode;
  onRename?: (title: string) => void;
  status: ReactNode;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTidy: () => void;
  connecting: boolean;
  onConnectTool: () => void;
  onFit: () => void;
  extra?: ReactNode;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState(title);
  const [shownTitle, setShownTitle] = useState(title);
  if (shownTitle !== title) {
    // title changed from outside (rename saved / reverted): reset the draft
    setShownTitle(title);
    setDraft(title);
  }
  const editable = mode !== 'view';

  const commit = () => {
    const t = draft.trim();
    if (!t || t === title) return setDraft(title);
    onRename?.(t);
  };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
      {mode === 'owner' && (
        <button type="button" onClick={onBack} className="btn px-2" aria-label="Về danh sách" title="Về danh sách">
          ←
        </button>
      )}
      {mode === 'owner' && onRename ? (
        <input
          aria-label="Tên mindmap"
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-base font-semibold outline-none hover:bg-surface-2 focus:bg-surface-2 sm:max-w-md"
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setDraft(title);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      ) : (
        <h1 className="min-w-0 flex-1 truncate px-2 text-base font-semibold sm:max-w-md">{title}</h1>
      )}
      {mode !== 'owner' && (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
          {mode === 'view' ? 'Chỉ xem' : 'Được sửa'}
        </span>
      )}
      <div className="text-xs text-muted" aria-live="polite">
        {status}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {editable && (
          <>
            <button type="button" className="btn px-2" onClick={onUndo} disabled={!canUndo} title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác">
              ↶
            </button>
            <button type="button" className="btn px-2" onClick={onRedo} disabled={!canRedo} title="Làm lại (Ctrl+Shift+Z)" aria-label="Làm lại">
              ↷
            </button>
            <button
              type="button"
              className={`btn ${connecting ? 'border-accent text-accent' : ''}`}
              onClick={onConnectTool}
              title="Chọn một ý, bấm Nối, rồi bấm ý đích"
            >
              Nối
            </button>
            <button type="button" className="btn" onClick={onTidy} title="Xếp lại toàn bộ cho cân đối">
              Sắp xếp gọn
            </button>
          </>
        )}
        <button type="button" className="btn" onClick={onFit} title="Vừa màn hình">
          Vừa màn hình
        </button>
        {extra}
      </div>
    </header>
  );
}
