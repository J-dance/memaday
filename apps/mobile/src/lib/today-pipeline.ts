// Orchestrates the client side of the today's-photo screen: decrypt the
// current selection and its comments, and encrypt outgoing comments — the
// same "server only ever sees ciphertext" shape as photo-pipeline.ts, just
// for today's single selection instead of the whole pool.

import { decryptPhotoBytes, decryptText, encryptText, photoBytesToDataUri } from '@memaday/core';
import {
  deleteReaction,
  fetchToday,
  listComments,
  postComment,
  postReaction,
  recordView,
  type GroupComment,
  type GroupReaction,
  type Viewer,
} from './selection-client';

// A small fixed starting set, not a schema/server restriction — the
// `emoji` column is plain text with no allowed-values check, so this list
// is just what the UI currently offers buttons for. Swapping in a bigger
// set or a full picker later doesn't need any backend change.
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '👍'];

export interface DecryptedSelection {
  id: string;
  localDate: string;
  dataUri: string;
  caption: string | null;
  uploaderId: string;
}

export interface DecryptedComment {
  id: string;
  userId: string;
  displayName: string;
  body: string;
  createdAt: string;
}

export interface DecryptedReaction {
  id: string;
  userId: string;
  emoji: string;
}

/**
 * Fetches today's selection (if any) and decrypts its photo + caption.
 * Returns `null` selection when the group has no current selection —
 * an empty pool, or a group that hasn't rotated yet — which is the nudge
 * to upload rather than an error (see docs/ROADMAP.md step 5).
 */
export async function fetchAndDecryptToday(
  groupId: string,
  groupKey: Uint8Array,
): Promise<{ selection: DecryptedSelection | null; views: Viewer[]; reactions: DecryptedReaction[] }> {
  const { selection, views, reactions } = await fetchToday(groupId);
  if (!selection) return { selection: null, views: [], reactions: [] };

  const ciphertext = new Uint8Array(await (await fetch(selection.downloadUrl)).arrayBuffer());
  const plaintext = await decryptPhotoBytes(ciphertext, selection.nonce, groupKey);
  const dataUri = await photoBytesToDataUri(plaintext);

  const caption =
    selection.caption && selection.captionNonce
      ? await decryptText(selection.caption, selection.captionNonce, groupKey)
      : null;

  const decryptedReactions = await decryptReactions(reactions, groupKey);

  return {
    selection: {
      id: selection.id,
      localDate: selection.localDate,
      dataUri,
      caption,
      uploaderId: selection.uploaderId,
    },
    views,
    reactions: decryptedReactions,
  };
}

/** Marks today's selection as seen by the caller. */
export function markTodayViewed(groupId: string): Promise<void> {
  return recordView(groupId);
}

async function decryptOneComment(
  comment: GroupComment,
  groupKey: Uint8Array,
): Promise<DecryptedComment | null> {
  try {
    const body = await decryptText(comment.body, comment.nonce, groupKey);
    return {
      id: comment.id,
      userId: comment.userId,
      displayName: comment.displayName,
      body,
      createdAt: comment.createdAt,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches and decrypts today's comment thread. Same "drop what fails to
 * decrypt rather than fail the whole list" approach as the photo pool —
 * see photo-pipeline.ts's fetchAndDecryptGroupPhotos.
 */
export async function fetchAndDecryptComments(
  groupId: string,
  groupKey: Uint8Array,
): Promise<DecryptedComment[]> {
  const comments = await listComments(groupId);
  const results = await Promise.all(comments.map((c) => decryptOneComment(c, groupKey)));
  return results.filter((c): c is DecryptedComment => c !== null);
}

/** Encrypts and posts a comment on today's selection. */
export async function encryptAndPostComment(
  groupId: string,
  text: string,
  groupKey: Uint8Array,
): Promise<DecryptedComment> {
  const { ciphertext, nonce } = await encryptText(text, groupKey);
  const posted = await postComment(groupId, { body: ciphertext, nonce });
  return {
    id: posted.id,
    userId: posted.userId,
    displayName: posted.displayName,
    body: text,
    createdAt: posted.createdAt,
  };
}

async function decryptReactions(
  reactions: GroupReaction[],
  groupKey: Uint8Array,
): Promise<DecryptedReaction[]> {
  const results = await Promise.all(
    reactions.map(async (r) => {
      try {
        const emoji = await decryptText(r.emoji, r.nonce, groupKey);
        return { id: r.id, userId: r.userId, emoji };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is DecryptedReaction => r !== null);
}

/**
 * Toggles the caller's reaction with `emoji` on today's selection: if
 * `existing` (the currently-decrypted reaction list) already has one of
 * the caller's own reactions with this exact emoji, deletes it; otherwise
 * encrypts and posts a new one. The server can't make this decision itself
 * — see docs/DECISIONS.md's "Reactions are E2E encrypted" entry — so the
 * caller (which already holds the decrypted list to render it) does.
 */
export async function toggleReaction(
  groupId: string,
  emoji: string,
  currentUserId: string,
  existing: DecryptedReaction[],
  groupKey: Uint8Array,
): Promise<{ type: 'added'; reaction: DecryptedReaction } | { type: 'removed'; id: string }> {
  const mine = existing.find((r) => r.userId === currentUserId && r.emoji === emoji);
  if (mine) {
    await deleteReaction(groupId, mine.id);
    return { type: 'removed', id: mine.id };
  }

  const { ciphertext, nonce } = await encryptText(emoji, groupKey);
  const posted = await postReaction(groupId, { emoji: ciphertext, nonce });
  return { type: 'added', reaction: { id: posted.id, userId: posted.userId, emoji } };
}
