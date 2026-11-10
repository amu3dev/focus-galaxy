import { useEffect, useRef, useState } from 'react';

export const PRIORITY_STORAGE_KEY = 'focus-galaxy-priorities-v2';
const WRITE_LOCK = `${PRIORITY_STORAGE_KEY}:write`;
export const GENESIS_BACKUP_KEY = `${PRIORITY_STORAGE_KEY}.genesis-backup`;
const GENESIS_PENDING_KEY = `${GENESIS_BACKUP_KEY}.pending`;

function pendingGenesisBackup(): { snapshot: string; backup: string | null } | null {
  const saved = window.localStorage.getItem(GENESIS_PENDING_KEY);
  if (saved === null) return null;
  const pending = JSON.parse(saved);
  if (!pending || typeof pending.snapshot !== 'string' || (pending.backup !== null && typeof pending.backup !== 'string')) {
    throw new Error('Invalid pending galaxy backup');
  }
  return pending;
}

// Under WRITE_LOCK: resolve the durable undo record before any further write.
function finishGenesisBackup() {
  const pending = pendingGenesisBackup();
  if (!pending) return;
  if (window.localStorage.getItem(PRIORITY_STORAGE_KEY) !== pending.snapshot
    && window.localStorage.getItem(GENESIS_BACKUP_KEY) !== pending.backup) {
    if (pending.backup === null) window.localStorage.removeItem(GENESIS_BACKUP_KEY);
    else window.localStorage.setItem(GENESIS_BACKUP_KEY, pending.backup);
  }
  window.localStorage.removeItem(GENESIS_PENDING_KEY);
}

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
  const replacing = useRef(false);
  const [backup, setBackup] = useState<string | null>(() => {
    try {
      const pending = pendingGenesisBackup();
      if (pending && window.localStorage.getItem(PRIORITY_STORAGE_KEY) !== pending.snapshot) return pending.backup;
      return window.localStorage.getItem(GENESIS_BACKUP_KEY);
    } catch { return null; }
  });

  // Template replacement uses the same revision and lock as ordinary edits.
  // Commit storage first: a failed backup/write must not replace session data.
  const replacePriorities = async (nextPriorities: unknown[], signal?: AbortSignal): Promise<boolean> => {
    if (replacing.current || status !== 'saved' || conflict.current || recoveryBlocked.current || !navigator.locks?.request) return false;
    replacing.current = true;
    setStatus('pending');
    try {
      return await navigator.locks.request(WRITE_LOCK, { mode: 'exclusive', signal }, () => {
        if (conflict.current || window.localStorage.getItem(PRIORITY_STORAGE_KEY) !== revision.current) {
          conflict.current = true;
          setStatus('conflict');
          return false;
        }
        const previous = JSON.stringify(priorities);
        // Reject unsaved state, including a state update whose effect has not run.
        if (previous !== revision.current) { setStatus('pending'); return false; }
        const next = JSON.stringify(nextPriorities);
        finishGenesisBackup(); // Fail closed if an earlier commit cannot be finalized.
        if (next !== previous) {
          if (priorities.length > 0) {
            window.localStorage.setItem(GENESIS_PENDING_KEY, JSON.stringify({ snapshot: next, backup: window.localStorage.getItem(GENESIS_BACKUP_KEY) }));
          }
          try {
            if (priorities.length > 0) window.localStorage.setItem(GENESIS_BACKUP_KEY, previous);
            window.localStorage.setItem(PRIORITY_STORAGE_KEY, next);
          } catch (error) {
            try { finishGenesisBackup(); } catch { /* The undo record survives failed rollback and reload. */ }
            throw error;
          }
          revision.current = next;
          if (priorities.length > 0) setBackup(previous);
          try { finishGenesisBackup(); } catch { /* Retry cleanup before any subsequent active write. */ }
        }
        setStatus('saved');
        return true;
      });
    } catch {
      setStatus(conflict.current ? 'conflict' : signal?.aborted ? 'saved' : 'error');
      return false;
    } finally {
      replacing.current = false;
    }
  };

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
      finishGenesisBackup();
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

  return { status, retry: () => setAttempt((current) => current + 1), backup, replacePriorities };
}
