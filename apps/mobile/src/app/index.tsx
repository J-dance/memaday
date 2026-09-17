import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { unwrapGroupKey } from '@memaday/core';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { authClient } from '@/lib/auth-client';
import { listGroups, type GroupSummary } from '@/lib/groups-client';
import type { Viewer } from '@/lib/selection-client';
import {
  encryptAndPostComment,
  fetchAndDecryptComments,
  fetchAndDecryptToday,
  markTodayViewed,
  REACTION_EMOJIS,
  toggleReaction,
  type DecryptedComment,
  type DecryptedReaction,
  type DecryptedSelection,
} from '@/lib/today-pipeline';
import { useGroupKeysSession } from '@/lib/group-keys-session';
import { useIdentitySession } from '@/lib/identity-session';
import { Spacing, MaxContentWidth } from '@/constants/theme';

export default function TodayScreen() {
  const { privateKey } = useIdentitySession();
  const { data: session } = authClient.useSession();
  const { getGroupKey, setGroupKey } = useGroupKeysSession();

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session || !privateKey) return;
    setError(null);
    try {
      const fetched = await listGroups();
      setGroups(fetched);

      for (const group of fetched) {
        if (!group.wrappedKey || getGroupKey(group.id)) continue;
        const groupKey = await unwrapGroupKey(group.wrappedKey, session.user.publicKey, privateKey);
        setGroupKey(group.id, groupKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load groups');
    }
  }, [session, privateKey, getGroupKey, setGroupKey]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const unlockedGroups = (groups ?? []).filter((group) => getGroupKey(group.id));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Today
        </ThemedText>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        {groups === null ? (
          <ActivityIndicator />
        ) : unlockedGroups.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No unlocked groups yet — create or join one on the Groups tab.
          </ThemedText>
        ) : (
          unlockedGroups.map((group) => (
            <TodaySection
              key={group.id}
              group={group}
              groupKey={getGroupKey(group.id)!}
              currentUserId={session?.user.id}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TodaySection({
  group,
  groupKey,
  currentUserId,
}: {
  group: GroupSummary;
  groupKey: Uint8Array;
  currentUserId: string | undefined;
}) {
  // undefined = still loading; null = loaded, no selection today.
  const [selection, setSelection] = useState<DecryptedSelection | null | undefined>(undefined);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [reactions, setReactions] = useState<DecryptedReaction[]>([]);
  const [comments, setComments] = useState<DecryptedComment[] | null>(null);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const today = await fetchAndDecryptToday(group.id, groupKey);
      setSelection(today.selection);
      setViewers(today.views);
      setReactions(today.reactions);

      if (today.selection) {
        setComments(await fetchAndDecryptComments(group.id, groupKey));
        // Best-effort — a failed view ping shouldn't block the screen from
        // showing the photo and comments that did load.
        await markTodayViewed(group.id).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load today's photo");
    }
  }, [group.id, groupKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleReaction(emoji: string) {
    if (!currentUserId) return;
    setError(null);
    // Optimistic: flip local state immediately, revert if the request fails
    // — reacting should feel instant, not wait on a round trip.
    const mine = reactions.find((r) => r.userId === currentUserId && r.emoji === emoji);
    const optimisticId = `optimistic-${Date.now()}`;
    setReactions((prev) =>
      mine
        ? prev.filter((r) => r.id !== mine.id)
        : [...prev, { id: optimisticId, userId: currentUserId, emoji }],
    );
    try {
      const result = await toggleReaction(group.id, emoji, currentUserId, reactions, groupKey);
      if (result.type === 'added') {
        setReactions((prev) => prev.map((r) => (r.id === optimisticId ? result.reaction : r)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update reaction');
      await load();
    }
  }

  async function handlePostComment() {
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    setError(null);
    try {
      const comment = await encryptAndPostComment(group.id, text, groupKey);
      setComments((prev) => [...(prev ?? []), comment]);
      setCommentText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post comment');
    } finally {
      setPosting(false);
    }
  }

  // Web-only for now (apps/mobile is a web build — see docs/ROADMAP.md).
  // Saving is meant to be easy and obvious, not discouraged — see
  // docs/DECISIONS.md's "Saving/screenshotting the photo is encouraged"
  // entry — so this is a plain browser download of the already-decrypted
  // image, no extra confirmation step.
  function handleSave() {
    if (!selection || Platform.OS !== 'web') return;
    const link = document.createElement('a');
    link.href = selection.dataUri;
    link.download = `${group.name.replace(/\s+/g, '-')}-${selection.localDate}.jpg`;
    link.click();
  }

  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <ThemedView style={styles.groupHeader}>
        <ThemedText type="smallBold">{group.name}</ThemedText>
        {group.hasUnseenPhoto && <ThemedView style={styles.unseenDot} />}
      </ThemedView>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      {selection === undefined ? (
        <ActivityIndicator />
      ) : selection === null ? (
        <ThemedText type="small" themeColor="textSecondary">
          No photo today yet — upload one on the Groups tab to get the pool started.
        </ThemedText>
      ) : (
        <>
          <Image source={{ uri: selection.dataUri }} style={styles.photo} contentFit="cover" />
          {selection.caption && <ThemedText type="small">{selection.caption}</ThemedText>}

          <ThemedText type="small" themeColor="textSecondary">
            {viewers.length === 0
              ? 'No one has seen this yet'
              : `Seen by ${viewers.map((viewer) => viewer.displayName).join(', ')}`}
          </ThemedText>

          <ThemedView style={styles.reactionRow}>
            {REACTION_EMOJIS.map((emoji) => {
              const count = reactions.filter((r) => r.emoji === emoji).length;
              const mine = reactions.some((r) => r.userId === currentUserId && r.emoji === emoji);
              return (
                <Pressable
                  key={emoji}
                  style={[styles.reactionChip, mine && styles.reactionChipMine]}
                  onPress={() => handleToggleReaction(emoji)}>
                  <ThemedText type="small">
                    {emoji}
                    {count > 0 ? ` ${count}` : ''}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>

          {Platform.OS === 'web' && (
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <ThemedText type="smallBold" style={styles.buttonLabel}>
                Save photo
              </ThemedText>
            </Pressable>
          )}

          <ThemedView style={styles.comments}>
            {comments === null ? (
              <ActivityIndicator />
            ) : comments.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No comments yet.
              </ThemedText>
            ) : (
              comments.map((comment) => (
                <ThemedView key={comment.id} style={styles.comment}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {comment.displayName}
                  </ThemedText>
                  <ThemedText type="small">{comment.body}</ThemedText>
                </ThemedView>
              ))
            )}
          </ThemedView>

          <ThemedView style={styles.commentForm}>
            <ThemedTextInput
              placeholder="Add a comment"
              value={commentText}
              onChangeText={setCommentText}
              style={styles.input}
            />
            <Pressable
              style={styles.button}
              onPress={handlePostComment}
              disabled={posting || !commentText.trim()}>
              {posting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText type="smallBold" style={styles.buttonLabel}>
                  Post
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    alignItems: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: {
    marginTop: Spacing.four,
    alignSelf: 'flex-start',
  },
  section: {
    alignSelf: 'stretch',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  unseenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3c87f7',
  },
  photo: {
    alignSelf: 'stretch',
    aspectRatio: 1,
    borderRadius: Spacing.two,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  reactionChip: {
    borderWidth: 1,
    borderColor: '#88888844',
    borderRadius: Spacing.four,
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
  },
  reactionChipMine: {
    borderColor: '#3c87f7',
  },
  saveButton: {
    backgroundColor: '#3c87f7',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
  },
  comments: {
    gap: Spacing.two,
  },
  comment: {
    gap: 2,
  },
  commentForm: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
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
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#ffffff',
  },
  error: {
    color: '#e5484d',
  },
});
