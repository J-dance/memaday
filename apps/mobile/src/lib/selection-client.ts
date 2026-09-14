// Thin fetch wrapper for apps/api's /v1/groups/:id/today routes — same
// plain-fetch-with-cookies approach as groups-client.ts/photos-client.ts.

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface TodaySelection {
  id: string;
  localDate: string;
  startsAt: string;
  expiresAt: string;
  photoId: string;
  uploaderId: string;
  width: number;
  height: number;
  /** Base64 AEAD nonce for the photo bytes fetched from `downloadUrl`. */
  nonce: string;
  caption: string | null;
  captionNonce: string | null;
  /** Short-lived presigned GET URL — fetch promptly, don't cache past
   * `expiresInSeconds`. */
  downloadUrl: string;
  expiresInSeconds: number;
}

export interface Viewer {
  userId: string;
  displayName: string;
  viewedAt: string;
}

export interface GroupComment {
  id: string;
  userId: string;
  displayName: string;
  /** Ciphertext, decrypted client-side with the group key. */
  body: string;
  nonce: string;
  createdAt: string;
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
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function fetchToday(
  groupId: string,
): Promise<{ selection: TodaySelection | null; views: Viewer[] }> {
  return request(`${API_URL}/v1/groups/${groupId}/today`);
}

export function recordView(groupId: string): Promise<void> {
  return request(`${API_URL}/v1/groups/${groupId}/today/view`, { method: 'POST' });
}

export function listComments(groupId: string): Promise<GroupComment[]> {
  return request(`${API_URL}/v1/groups/${groupId}/today/comments`);
}

export function postComment(
  groupId: string,
  input: { body: string; nonce: string },
): Promise<GroupComment> {
  return request(`${API_URL}/v1/groups/${groupId}/today/comments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
