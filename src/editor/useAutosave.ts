'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorApi } from './api';
import type { EditorStore } from './store';

export type SaveStatus =
  | 'saved'
  | 'saving'
  | 'dirty'
  | 'error' // network/server failure, retrying
  | 'conflict' // someone saved a newer version
  | 'expired' // session gone (401)
  | 'forbidden' // link became view-only / disabled (403)
  | 'invalid'; // 400/413: cannot be saved as is

const BLOCKED: SaveStatus[] = ['conflict', 'expired', 'forbidden', 'invalid'];

export function useAutosave(
  store: EditorStore,
  api: EditorApi,
  opts: { debounceMs?: number; retryMs?: number },
): { status: SaveStatus; saveNow(): void; reloadLatest(): Promise<void>; flush(): Promise<void>; retry(): void } {
  const debounceMs = opts.debounceMs ?? 1500;
  const retryMs = opts.retryMs ?? 5000;
  const [status, setStatusState] = useState<SaveStatus>('saved');
  const statusRef = useRef<SaveStatus>('saved');
  const setStatus = useCallback((s: SaveStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const clearTimers = () => {
    if (debounce.current) clearTimeout(debounce.current);
    if (retry.current) clearTimeout(retry.current);
    debounce.current = retry.current = null;
  };

  // Self-reference for timers scheduled from inside doSave.
  const doSaveRef = useRef<() => Promise<void>>(async () => {});
  const doSave = useCallback(async (): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const s = store.getState();
    if (s.readOnly || !s.dirty || BLOCKED.includes(statusRef.current)) return;
    const data = s.data;
    const version = s.version;
    setStatus('saving');
    const run = (async () => {
      const res = await apiRef.current.save(data, version);
      if (res.ok) {
        store.getState().markSaved(res.version, data);
        if (store.getState().dirty) {
          setStatus('dirty');
          debounce.current = setTimeout(() => void doSaveRef.current(), debounceMs);
        } else {
          setStatus('saved');
        }
        return;
      }
      switch (res.status) {
        case 409:
          return setStatus('conflict');
        case 401:
          return setStatus('expired');
        case 403:
          return setStatus('forbidden');
        case 400:
        case 413:
          return setStatus('invalid');
        default:
          setStatus('error');
          retry.current = setTimeout(() => void doSaveRef.current(), retryMs);
      }
    })();
    inFlight.current = run.finally(() => {
      inFlight.current = null;
    });
    return inFlight.current;
  }, [store, debounceMs, retryMs, setStatus]);
  useEffect(() => {
    doSaveRef.current = doSave;
  }, [doSave]);

  // Debounced save after every edit.
  useEffect(() => {
    return store.subscribe((s, prev) => {
      if (s.data === prev.data || !s.dirty || s.readOnly) return;
      if (BLOCKED.includes(statusRef.current)) return;
      if (statusRef.current !== 'saving' && statusRef.current !== 'error') setStatus('dirty');
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void doSave(), debounceMs);
    });
  }, [store, doSave, debounceMs, setStatus]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (store.getState().dirty || inFlight.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [store]);

  const reloadLatest = useCallback(async () => {
    clearTimers();
    const { data, version } = await apiRef.current.load();
    store.getState().load(data, version, store.getState().readOnly);
    setStatus('saved');
  }, [store, setStatus]);

  // When the tab comes back, pick up other people's saves.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if (inFlight.current || BLOCKED.includes(statusRef.current)) return;
      let v: number;
      try {
        v = await apiRef.current.getVersion();
      } catch {
        return;
      }
      const s = store.getState();
      if (v <= s.version) return;
      if (s.dirty) setStatus('conflict');
      else await reloadLatest().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [store, reloadLatest, setStatus]);

  useEffect(() => () => clearTimers(), []);

  const saveNow = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (retry.current) clearTimeout(retry.current);
    void doSave();
  }, [doSave]);

  const flush = useCallback(async () => {
    if (debounce.current) clearTimeout(debounce.current);
    await doSave();
  }, [doSave]);

  /** After re-login: leave the blocked state and try again. */
  const retryNow = useCallback(() => {
    if (statusRef.current === 'expired' || statusRef.current === 'error') {
      setStatus('dirty');
      void doSave();
    }
  }, [doSave, setStatus]);

  return { status, saveNow, reloadLatest, flush, retry: retryNow };
}
