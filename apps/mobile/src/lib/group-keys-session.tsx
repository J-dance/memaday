import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

// Raw (unwrapped) group symmetric keys, held in memory only for the
// current session — same rationale as identity-session.tsx: nothing here
// is ever persisted, only ever re-derived (generated at group creation, or
// unwrapped with the identity private key at admit time).
interface GroupKeysSessionValue {
  getGroupKey: (groupId: string) => Uint8Array | undefined;
  setGroupKey: (groupId: string, key: Uint8Array) => void;
}

const GroupKeysSessionContext = createContext<GroupKeysSessionValue | null>(null);

export function GroupKeysSessionProvider({ children }: { children: ReactNode }) {
  // A ref (not state) for the Map itself — callers read it synchronously by
  // groupId rather than needing every key update to re-render every
  // consumer, the way a plain useState<Map> would.
  const keysRef = useRef(new Map<string, Uint8Array>());
  const [, forceRerender] = useState(0);

  const getGroupKey = useCallback((groupId: string) => keysRef.current.get(groupId), []);
  const setGroupKey = useCallback((groupId: string, key: Uint8Array) => {
    keysRef.current.set(groupId, key);
    forceRerender((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ getGroupKey, setGroupKey }), [getGroupKey, setGroupKey]);

  return <GroupKeysSessionContext.Provider value={value}>{children}</GroupKeysSessionContext.Provider>;
}

export function useGroupKeysSession() {
  const value = useContext(GroupKeysSessionContext);
  if (!value) {
    throw new Error('useGroupKeysSession must be used within a GroupKeysSessionProvider');
  }
  return value;
}
