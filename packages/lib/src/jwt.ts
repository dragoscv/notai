import { SignJWT, jwtVerify } from 'jose';

/**
 * Compact, short-lived JWTs used to auth clients to the Hocuspocus server.
 * The web app signs these server-side with HOCUSPOCUS_JWT_SECRET, the
 * hocuspocus server verifies with the same secret.
 */

export interface RealtimeTokenPayload {
  sub: string; // user id
  name: string;
  email: string;
  noteId: string;
  role: 'owner' | 'editor' | 'viewer';
}

const ISSUER = 'notai-web';
const AUDIENCE = 'notai-realtime';

export async function signRealtimeToken(
  payload: RealtimeTokenPayload,
  secret: string,
  ttlSeconds = 60 * 60, // 1h
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${ttlSeconds}s`)
    .setSubject(payload.sub)
    .sign(key);
}

export async function verifyRealtimeToken(
  token: string,
  secret: string,
): Promise<RealtimeTokenPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return payload as unknown as RealtimeTokenPayload;
}
