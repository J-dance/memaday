import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { generateIdentityKeypair, unlockIdentityKeypair } from '@memaday/core';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { authClient } from '@/lib/auth-client';
import { useIdentitySession } from '@/lib/identity-session';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type UnlockableUser = {
  email: string;
  encryptedPrivateKey: string;
  kdfSalt: string;
};

// Gates the whole app behind auth + an unlocked identity key. There are
// three states, not two, because "logged in" (a server session cookie)
// and "has the identity private key" (docs/ENCRYPTION.md) are different
// things — the key only ever lives in memory (see lib/identity-session.tsx)
// so a page reload keeps the session but loses the key, and needs its own
// "unlock" step rather than a full re-login.
export function AuthGate({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const { privateKey, setPrivateKey } = useIdentitySession();

  if (isPending) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (data && privateKey) {
    return <>{children}</>;
  }

  if (data) {
    return <UnlockForm user={data.user} onUnlocked={setPrivateKey} />;
  }

  return <AuthForm onAuthenticated={setPrivateKey} />;
}

function AuthForm({ onAuthenticated }: { onAuthenticated: (key: Uint8Array) => void }) {
  const [mode, setMode] = useState<'sign-up' | 'sign-in'>('sign-up');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'sign-up') {
        // Generate the identity keypair before calling the server — the
        // signup request bundles the key fields in with the account
        // creation call itself (docs/DECISIONS.md's "single request" choice),
        // so there's no account without a keypair attached.
        const identity = await generateIdentityKeypair(password);
        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name: displayName,
          publicKey: identity.publicKey,
          encryptedPrivateKey: identity.encryptedPrivateKey,
          kdfSalt: identity.kdfSalt,
        });
        if (signUpError) {
          throw new Error(signUpError.message ?? 'Sign up failed');
        }
        onAuthenticated(identity.privateKey);
      } else {
        const { data, error: signInError } = await authClient.signIn.email({ email, password });
        if (signInError || !data) {
          throw new Error(signInError?.message ?? 'Sign in failed');
        }
        const key = await unlockIdentityKeypair(password, data.user.encryptedPrivateKey, data.user.kdfSalt);
        onAuthenticated(key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {mode === 'sign-up' ? 'Create an account' : 'Log in'}
        </ThemedText>

        {mode === 'sign-up' && (
          <TextInput
            placeholder="Display name"
            autoCapitalize="words"
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.input}
          />
        )}
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText type="smallBold" style={styles.buttonLabel}>
              {mode === 'sign-up' ? 'Sign up' : 'Log in'}
            </ThemedText>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>
          <ThemedText type="link" themeColor="textSecondary">
            {mode === 'sign-up' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function UnlockForm({ user, onUnlocked }: { user: UnlockableUser; onUnlocked: (key: Uint8Array) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleUnlock() {
    setError(null);
    setSubmitting(true);
    try {
      const key = await unlockIdentityKeypair(password, user.encryptedPrivateKey, user.kdfSalt);
      onUnlocked(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Welcome back
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {user.email}
        </ThemedText>
        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        <Pressable style={styles.button} onPress={handleUnlock} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText type="smallBold" style={styles.buttonLabel}>
              Unlock
            </ThemedText>
          )}
        </Pressable>
        <Pressable onPress={() => authClient.signOut()}>
          <ThemedText type="link" themeColor="textSecondary">
            Log out
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#88888844',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3c87f7',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#ffffff',
  },
  error: {
    color: '#e5484d',
  },
});
