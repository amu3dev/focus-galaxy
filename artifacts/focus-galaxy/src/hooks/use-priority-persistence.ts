import { useEffect, useRef, useState } from 'react';

export const PRIORITY_STORAGE_KEY = 'focus-galaxy-priorities-v2';
const WRITE_LOCK = `${PRIORITY_STORAGE_KEY}:write`;
type PersistenceStatus = 'pending' | 'saved' | 'error' | 'conflict' | 'recovery-blocked' | 'unavailable';

// Called only while holding WRITE_LOCK, after checking the source revision.
function backUpRejectedSnapshot(saved: string): boolean {
  try {
    let key = `${PRIORITY_STORAGE_KEY}.corrupt`;
    let suffix = 1;
    let existing = window.localStorage.getItem(key);
    while (existing !== null && existing !== saved) {
      key = `${PRIORITY_STORAGE_KEY}.corrupt-${suffix++}`;
      existing = window.localStorage.getItem(key);
    }
    if (existing === null) window.localStorage.setItem(key, saved);
    return true;
  } catch {
    return false;
  }
}

export function usePriorityPersistence(
  priorities: unknown[],
  initialSnapshot: string | null | undefined,
  needsRecovery: boolean,
) {
  // Exact bytes, rather than a separate counter/key, make revision + content a
  // single localStorage value. No sidecar metadata can be torn by a quota error.
  const revision = useRef(initialSnapshot);
  const conflict = useRef(false);
  const recoveryBlocked = useRef(initialSnapshot === undefined);
  const recoveryPending = useRef(needsRecovery);
  const [status, setStatus] = useState<PersistenceStatus>('pending');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    try {
      if (typeof navigator.locks?.request === 'function' && typeof navigator.storage?.persist === 'function') {
        void navigator.storage.persist().catch(() => {});
      }
    } catch {
      // StorageManager persistence is optional enhancement on mobile browsers.
    }
    const checkRevision = () => {
      if (revision.current === undefined || conflict.current) return;
      try {
        if (window.localStorage.getItem(PRIORITY_STORAGE_KEY) !== revision.current) {
          conflict.current = true;
          setStatus('conflict');
        }
      } catch {
        setStatus(conflict.current ? 'conflict' : 'error');
      }
    };
    const onStorage = (event: StorageEvent) => {
      // Read the current value: a queued event may describe an older write.
      if (event.key !== null && event.key !== PRIORITY_STORAGE_KEY) return;
      try {
        if (event.storageArea === window.localStorage) checkRevision();
      } catch {
        setStatus(conflict.current ? 'conflict' : 'error');
      }
    };
    const onVisibility = () => { if (!document.hidden) checkRevision(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', checkRevision);
    window.addEventListener('focus', checkRevision);
    document.addEventListener('visibilitychange', onVisibility);
    // Covers a write between the initial read and installing listeners.
    checkRevision();
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', checkRevision);
      window.removeEventListener('focus', checkRevision);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (conflict.current) { setStatus('conflict'); return; }
    if (recoveryBlocked.current) { setStatus('recovery-blocked'); return; }
    if (!navigator.locks?.request) {
      // A localStorage spin lock is not a safe fallback for atomic comparison.
      setStatus('unavailable');
      return;
    }
    let cancelled = false;
    const abort = new AbortController();
    // Keep an unsaved warning visible while a retry waits for the lock.
    setStatus((current) => current === 'saved' ? 'pending' : current);
    void navigator.locks.request(WRITE_LOCK, { mode: 'exclusive', signal: abort.signal }, () => {
      if (cancelled) return;
      if (conflict.current) { setStatus('conflict'); return; }
      const current = window.localStorage.getItem(PRIORITY_STORAGE_KEY);
      if (current !== revision.current) {
        conflict.current = true;
        setStatus('conflict');
        return;
      }
      if (recoveryPending.current && current !== null && !backUpRejectedSnapshot(current)) {
        recoveryBlocked.current = true;
        setStatus('recovery-blocked');
        return;
      }
      const next = JSON.stringify(priorities);
      if (next !== current) window.localStorage.setItem(PRIORITY_STORAGE_KEY, next);
      // Advance only inside the lock, after the actual write succeeds (or the
      // exact desired bytes are already persisted). Failed writes keep revision.
      revision.current = next;
      recoveryPending.current = false;
      setStatus('saved');
    }).catch(() => {
      if (cancelled) return;
      setStatus(conflict.current ? 'conflict' : 'error');
    });
    return () => {
      cancelled = true;
      abort.abort(); // An obsolete queued snapshot must never run later.
    };
  }, [priorities, attempt]);

  return { status, retry: () => setAttempt((current) => current + 1) };
}
