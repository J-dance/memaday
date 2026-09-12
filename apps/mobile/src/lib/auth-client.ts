import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

// Points at apps/api's Better Auth mount (see apps/api/src/auth.ts's
// `basePath: "/v1/auth"`). This is cross-origin from the Expo web dev
// server, so cookies need `credentials: "include"` here and a matching
// CORS + trustedOrigins entry for this origin on the API side (see
// apps/api/src/index.ts and apps/api/wrangler.jsonc's WEB_ORIGIN).
export const authClient = createAuthClient({
  baseURL: `${process.env.EXPO_PUBLIC_API_URL}/v1/auth`,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [
    // Lets the client type and send the E2EE identity-keypair fields
    // (docs/ENCRYPTION.md) without importing apps/api's server code across
    // the app/api boundary. This shape must match `user.additionalFields`
    // in apps/api/src/auth.ts.
    inferAdditionalFields({
      user: {
        publicKey: { type: 'string', required: true },
        encryptedPrivateKey: { type: 'string', required: true },
        kdfSalt: { type: 'string', required: true },
      },
    }),
  ],
});
