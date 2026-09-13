// Orchestrates the client side of photo upload/download — see
// docs/ENCRYPTION.md and docs/ARCHITECTURE.md's "upload path" for the
// design this implements: downsize + strip EXIF + encrypt, then presign +
// PUT + confirm, all before any byte reaches the API.

import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  decryptCaption,
  decryptPhotoBytes,
  encryptCaption,
  encryptPhotoBytes,
  photoBytesToDataUri,
} from '@memaday/core';
import {
  confirmPhotoUpload,
  listGroupPhotos,
  presignPhotoUpload,
  type ConfirmedPhoto,
  type GroupPhoto,
} from './photos-client';

// The longest edge a photo is downsized to before encryption. This is the
// only size anyone will ever see it at — docs/ENCRYPTION.md rules out any
// server-side resizing, ever, since the server can't read the bytes to
// resize them — so it has to be chosen upfront rather than adjusted later.
const MAX_DIMENSION = 1600;

function downsizedDimensions(width: number, height: number) {
  const longest = Math.max(width, height);
  if (longest <= MAX_DIMENSION) return { width, height };
  const scale = MAX_DIMENSION / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Picks a photo from the library, downsizes it and re-encodes it as JPEG
 * (which strips EXIF as a side effect — expo-image-manipulator drops all
 * metadata on save, confirmed behavior even for images that don't need
 * resizing, which is why this always renders+saves rather than only doing
 * so when a resize is needed), encrypts it with the group key, and
 * uploads + confirms it. Returns null if the user cancels the picker.
 */
export async function pickAndUploadPhoto(
  groupId: string,
  groupKey: Uint8Array,
  caption?: string,
): Promise<ConfirmedPhoto | null> {
  // No-ops on web (no permission dialog exists there) — see the Expo
  // ImagePicker docs; still called for when native ships.
  await ImagePicker.requestMediaLibraryPermissionsAsync();

  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  const target = downsizedDimensions(asset.width, asset.height);
  if (target.width !== asset.width || target.height !== asset.height) {
    context.resize(target);
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

  const plaintext = new Uint8Array(await (await fetch(saved.uri)).arrayBuffer());
  const { ciphertext, nonce } = await encryptPhotoBytes(plaintext, groupKey);

  let captionCiphertext: string | undefined;
  let captionNonce: string | undefined;
  if (caption) {
    const encrypted = await encryptCaption(caption, groupKey);
    captionCiphertext = encrypted.ciphertext;
    captionNonce = encrypted.nonce;
  }

  const presigned = await presignPhotoUpload(groupId);
  // Wrapped in a Blob, and cast past TS's `Uint8Array<ArrayBufferLike>` vs
  // `Uint8Array<ArrayBuffer>` distinction — libsodium's return type doesn't
  // pin down the buffer as a concrete ArrayBuffer (as opposed to
  // SharedArrayBuffer, which it never actually is here), which is all the
  // DOM lib's BlobPart/BodyInit types care about.
  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    body: new Blob([ciphertext as Uint8Array<ArrayBuffer>]),
  });
  if (!putResponse.ok) {
    throw new Error(`Upload to storage failed (${putResponse.status})`);
  }

  return confirmPhotoUpload({
    photoId: presigned.photoId,
    groupId,
    nonce,
    width: saved.width,
    height: saved.height,
    caption: captionCiphertext,
    captionNonce,
  });
}

export interface DecryptedPhoto {
  id: string;
  uploaderId: string;
  dataUri: string;
  caption: string | null;
  createdAt: string;
}

async function decryptOne(photo: GroupPhoto, groupKey: Uint8Array): Promise<DecryptedPhoto> {
  const ciphertext = new Uint8Array(await (await fetch(photo.downloadUrl)).arrayBuffer());
  const plaintext = await decryptPhotoBytes(ciphertext, photo.nonce, groupKey);
  const dataUri = await photoBytesToDataUri(plaintext);

  const caption =
    photo.caption && photo.captionNonce
      ? await decryptCaption(photo.caption, photo.captionNonce, groupKey)
      : null;

  return { id: photo.id, uploaderId: photo.uploaderId, dataUri, caption, createdAt: photo.createdAt };
}

/**
 * Fetches and decrypts every photo in a group's pool. A single photo
 * failing (e.g. its presigned URL expired between listing and fetching)
 * doesn't fail the whole batch — it's just dropped, since a caller re-lists
 * to get fresh URLs rather than retrying a stale one.
 */
export async function fetchAndDecryptGroupPhotos(
  groupId: string,
  groupKey: Uint8Array,
): Promise<DecryptedPhoto[]> {
  const photos = await listGroupPhotos(groupId);
  const results = await Promise.all(
    photos.map((photo) => decryptOne(photo, groupKey).catch(() => null)),
  );
  return results.filter((photo): photo is DecryptedPhoto => photo !== null);
}
