import { AwsClient } from "aws4fetch";
import type { Bindings } from "./bindings.js";

// How long a presigned upload URL stays valid. Generous enough to survive a
// slow mobile upload, short enough that a leaked URL (e.g. in a log) isn't a
// standing hole.
const UPLOAD_URL_EXPIRY_SECONDS = 600;

// Downloads are signed much shorter-lived than uploads — a listing is
// expected to be fetched and used almost immediately (see
// docs/DECISIONS.md's "Photo downloads use presigned GET URLs too" entry),
// not held onto, so there's no slow-upload case to accommodate.
const DOWNLOAD_URL_EXPIRY_SECONDS = 60;

// R2's S3-compatible endpoint, used only for this presigning path — see
// docs/DECISIONS.md's "Presigned R2 uploads via the S3 API" entry for why
// this is a different code path from Cloudflare's native R2 binding.
function r2Endpoint(env: Bindings, key: string) {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key}`;
}

// The one place a photo's storage key is constructed, so presign and
// confirm always agree on it — confirm derives the key itself from
// (groupId, photoId) rather than trusting a client-supplied storage key,
// which would otherwise let a client claim a key outside its own group's
// namespace.
export function photoStorageKey(groupId: string, photoId: string) {
  return `${groupId}/${photoId}`;
}

// Shared by upload and download presigning — `region: "auto"` is what R2
// expects in place of a real AWS region for SigV4 signing.
async function presign(
  env: Bindings,
  key: string,
  method: "PUT" | "GET",
  expiresInSeconds: number,
) {
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const url = new URL(r2Endpoint(env, key));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));

  const signed = await client.sign(url, { method, aws: { signQuery: true } });
  return signed.url;
}

// Signs a PUT URL the client can upload ciphertext to directly, without the
// request ever passing through this Worker.
export async function presignPhotoUpload(env: Bindings, key: string) {
  const uploadUrl = await presign(env, key, "PUT", UPLOAD_URL_EXPIRY_SECONDS);
  return { uploadUrl, expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS };
}

// Signs a GET URL the client can fetch ciphertext from directly. Called
// once per photo whenever a group's pool is listed, so access is re-checked
// (via assertHoldsGroupKey in the calling route) every time, rather than a
// URL working forever once issued.
export async function presignPhotoDownload(env: Bindings, key: string) {
  const downloadUrl = await presign(
    env,
    key,
    "GET",
    DOWNLOAD_URL_EXPIRY_SECONDS,
  );
  return { downloadUrl, expiresInSeconds: DOWNLOAD_URL_EXPIRY_SECONDS };
}
