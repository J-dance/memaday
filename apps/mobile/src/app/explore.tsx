import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { generateGroupKey, unwrapGroupKey, wrapGroupKey } from '@memaday/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { authClient } from '@/lib/auth-client';
import {
  createGroup,
  joinGroup,
  listGroups,
  listPendingMembers,
  submitGroupKey,
  type GroupSummary,
} from '@/lib/groups-client';
import { fetchAndDecryptGroupPhotos, pickAndUploadPhoto, type DecryptedPhoto } from '@/lib/photo-pipeline';
import { useGroupKeysSession } from '@/lib/group-keys-session';
import { useIdentitySession } from '@/lib/identity-session';
import { Spacing, MaxContentWidth } from '@/constants/theme';

// Whenever a key-holding member's client sees a group, it checks for
// members waiting to be let in and wraps+uploads a key for each — silently,
// no approval prompt (docs/DECISIONS.md's "automatic admit" choice). This
// runs after every group-list refresh rather than on a timer, since
// there's no push/realtime infra yet (see docs/ARCHITECTURE.md).
async function admitPendingMembers(groupId: string, groupKey: Uint8Array) {
  const pending = await listPendingMembers(groupId);
  for (const member of pending) {
    const wrappedKey = await wrapGroupKey(groupKey, member.publicKey);
    await submitGroupKey(groupId, member.userId, wrappedKey);
  }
}

export default function GroupsScreen() {
  const { privateKey } = useIdentitySession();
  const { data: session } = authClient.useSession();
  const { getGroupKey, setGroupKey } = useGroupKeysSession();

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!session || !privateKey) return;
    setRefreshing(true);
    setError(null);
    try {
      const fetched = await listGroups();
      setGroups(fetched);

      for (const group of fetched) {
        if (!group.wrappedKey) continue;

        let groupKey = getGroupKey(group.id);
        if (!groupKey) {
          groupKey = await unwrapGroupKey(group.wrappedKey, session.user.publicKey, privateKey);
          setGroupKey(group.id, groupKey);
        }

        // Best-effort: one member's client failing to admit shouldn't block
        // the rest of the screen from loading.
        await admitPendingMembers(group.id, groupKey).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load groups');
    } finally {
      setRefreshing(false);
    }
  }, [session, privateKey, getGroupKey, setGroupKey]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Groups
        </ThemedText>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        {groups === null ? (
          <ActivityIndicator />
        ) : (
          <ThemedView style={styles.groupList}>
            {groups.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                No groups yet — create one or join with an invite code.
              </ThemedText>
            )}
            {groups.map((group) => (
              <GroupRow key={group.id} group={group} groupKey={getGroupKey(group.id)} />
            ))}
          </ThemedView>
        )}

        <Pressable style={styles.refreshButton} onPress={refresh} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator />
          ) : (
            <ThemedText type="link" themeColor="textSecondary">
              Refresh
            </ThemedText>
          )}
        </Pressable>

        <CreateGroupForm
          ownPublicKey={session?.user.publicKey}
          onCreated={async (id, key) => {
            setGroupKey(id, key);
            await refresh();
          }}
        />
        <JoinGroupForm onJoined={refresh} />
      </ThemedView>
    </SafeAreaView>
  );
}

function GroupRow({ group, groupKey }: { group: GroupSummary; groupKey: Uint8Array | undefined }) {
  const [photos, setPhotos] = useState<DecryptedPhoto[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPhotos = useCallback(async () => {
    if (!groupKey) return;
    try {
      setPhotos(await fetchAndDecryptGroupPhotos(group.id, groupKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load photos');
    }
  }, [group.id, groupKey]);

  useEffect(() => {
    refreshPhotos();
  }, [refreshPhotos]);

  async function handleUpload() {
    if (!groupKey) return;
    setUploading(true);
    setError(null);
    try {
      const confirmed = await pickAndUploadPhoto(group.id, groupKey);
      if (confirmed) await refreshPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.groupRow}>
      <ThemedText type="smallBold">{group.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {groupKey ? '🔓 unlocked' : '🔒 waiting for a member to let you in'}
      </ThemedText>
      <ThemedText type="code">invite code: {group.inviteCode}</ThemedText>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      {groupKey && (
        <>
          <Pressable style={styles.uploadButton} onPress={handleUpload} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText type="smallBold" style={styles.buttonLabel}>
                Add photo
              </ThemedText>
            )}
          </Pressable>

          {photos === null ? (
            <ActivityIndicator />
          ) : photos.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No photos yet — be the first to add one.
            </ThemedText>
          ) : (
            <ScrollView horizontal style={styles.photoRow}>
              {photos.map((photo) => (
                <Image key={photo.id} source={{ uri: photo.dataUri }} style={styles.thumbnail} />
              ))}
            </ScrollView>
          )}
        </>
      )}
    </ThemedView>
  );
}

function CreateGroupForm({
  ownPublicKey,
  onCreated,
}: {
  ownPublicKey: string | undefined;
  onCreated: (groupId: string, groupKey: Uint8Array) => void;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!ownPublicKey) return;
    setSubmitting(true);
    setError(null);
    try {
      const groupKey = await generateGroupKey();
      const wrappedKeyForSelf = await wrapGroupKey(groupKey, ownPublicKey);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const created = await createGroup({ name, timezone, wrappedKeyForSelf });
      setName('');
      onCreated(created.id, groupKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.form}>
      <ThemedText type="smallBold">Create a group</ThemedText>
      <ThemedTextInput placeholder="Group name" value={name} onChangeText={setName} style={styles.input} />
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      <Pressable style={styles.button} onPress={handleCreate} disabled={submitting || !name}>
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <ThemedText type="smallBold" style={styles.buttonLabel}>
            Create
          </ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

function JoinGroupForm({ onJoined }: { onJoined: () => void }) {
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setSubmitting(true);
    setError(null);
    try {
      await joinGroup(inviteCode.trim().toUpperCase());
      setInviteCode('');
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join group');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.form}>
      <ThemedText type="smallBold">Join a group</ThemedText>
      <ThemedTextInput
        placeholder="Invite code"
        autoCapitalize="characters"
        value={inviteCode}
        onChangeText={setInviteCode}
        style={styles.input}
      />
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      <Pressable style={styles.button} onPress={handleJoin} disabled={submitting || !inviteCode}>
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <ThemedText type="smallBold" style={styles.buttonLabel}>
            Join
          </ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    marginTop: Spacing.four,
  },
  groupList: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  groupRow: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  refreshButton: {
    alignSelf: 'flex-start',
  },
  uploadButton: {
    backgroundColor: '#3c87f7',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
  },
  photoRow: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: Spacing.one,
    marginRight: Spacing.one,
  },
  form: {
    alignSelf: 'stretch',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
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
