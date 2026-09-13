// Thin fetch wrapper for apps/api's /v1/photos and /v1/groups/:id/photos
// routes — same plain-fetch-with-cookies approach as groups-client.ts, not
// a generated client (packages/api-client doesn't exist yet — see
// docs/ARCHITECTURE.md's repo layout).

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface PresignedUpload {
  photoId: string;
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface ConfirmedPhoto {
  id: string;
  groupId: string;
  storageKey: string;
  width: number;
  height: number;
  caption: string | null;
  captionNonce: string | null;
  state: string;
}

export interface GroupPhoto {
  id: string;
  uploaderId: string;
  width: number;
  height: number;
  /** Base64 AEAD nonce for the photo bytes fetched from `downloadUrl`. */
  nonce: string;
  /** Ciphertext, or null if this photo has no caption. */
  caption: string | null;
  /** Base64 AEAD nonce for `caption` — a separate ciphertext under the
   * same group key, so it can't share the photo's own nonce (see
   * docs/DECISIONS.md#separate-aead-nonce-for-the-caption). Null exactly
   * when `caption` is null. */
  captionNonce: string | null;
  createdAt: string;
  /** Short-lived presigned GET URL — fetch promptly, don't cache past
   * `expiresInSeconds`. */
  downloadUrl: string;
  expiresInSeconds: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function presignPhotoUpload(groupId: string): Promise<PresignedUpload> {
  return request(`${API_URL}/v1/photos/presign`, {
    method: 'POST',
    body: JSON.stringify({ groupId }),
  });
}

export function confirmPhotoUpload(input: {
  photoId: string;
  groupId: string;
  nonce: string;
  width: number;
  height: number;
  caption?: string;
  captionNonce?: string;
}): Promise<ConfirmedPhoto> {
  return request(`${API_URL}/v1/photos/confirm`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listGroupPhotos(groupId: string): Promise<GroupPhoto[]> {
  return request(`${API_URL}/v1/groups/${groupId}/photos`);
}
