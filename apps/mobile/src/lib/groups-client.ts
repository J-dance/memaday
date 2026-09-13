// Thin fetch wrapper for apps/api's /v1/groups routes. Not a Better Auth
// client (that's auth-client.ts) — just plain fetch with the same
// cross-origin cookie handling, since these routes sit behind the same
// session.

const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/v1/groups`;

export interface GroupSummary {
  id: string;
  name: string;
  timezone: string;
  rotationHour: number;
  inviteCode: string;
  /** This user's wrapped copy of the group key — null until an existing
   * member's client notices and admits them (docs/ENCRYPTION.md#3-adding-a-member). */
  wrappedKey: string | null;
}

export interface PendingMember {
  userId: string;
  publicKey: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
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

export function listGroups(): Promise<GroupSummary[]> {
  return request('');
}

export function createGroup(input: {
  name: string;
  timezone: string;
  rotationHour?: number;
  wrappedKeyForSelf: string;
}): Promise<{ id: string; name: string; timezone: string; inviteCode: string }> {
  return request('', { method: 'POST', body: JSON.stringify(input) });
}

export function joinGroup(inviteCode: string): Promise<{ id: string; name: string }> {
  return request('/join', { method: 'POST', body: JSON.stringify({ inviteCode }) });
}

export function listPendingMembers(groupId: string): Promise<PendingMember[]> {
  return request(`/${groupId}/pending-members`);
}

export function submitGroupKey(groupId: string, userId: string, wrappedKey: string): Promise<void> {
  return request(`/${groupId}/keys`, {
    method: 'POST',
    body: JSON.stringify({ userId, wrappedKey }),
  });
}
