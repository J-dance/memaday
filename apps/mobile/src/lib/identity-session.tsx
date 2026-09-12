import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// Holds the unlocked X25519 private key (docs/ENCRYPTION.md) for the
// current session, in memory only — it's never written to storage or sent
// anywhere. Re-derived from the password at every signup/login instead of
// persisted, which is exactly the multi-device property the design relies
// on (see ENCRYPTION.md's "per-user keypair" section).
interface IdentitySessionValue {
  privateKey: Uint8Array | null;
  setPrivateKey: (key: Uint8Array | null) => void;
}

const IdentitySessionContext = createContext<IdentitySessionValue | null>(null);

export function IdentitySessionProvider({ children }: { children: ReactNode }) {
  const [privateKey, setPrivateKey] = useState<Uint8Array | null>(null);
  const value = useMemo(() => ({ privateKey, setPrivateKey }), [privateKey]);

  return <IdentitySessionContext.Provider value={value}>{children}</IdentitySessionContext.Provider>;
}

export function useIdentitySession() {
  const value = useContext(IdentitySessionContext);
  if (!value) {
    throw new Error('useIdentitySession must be used within an IdentitySessionProvider');
  }
  return value;
}
