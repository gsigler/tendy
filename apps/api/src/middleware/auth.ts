import { createMiddleware } from "hono/factory";
import * as jose from "jose";
import { hashKey, verify as verifyApiKey } from "../services/api-key.service.js";

export type JwtPayload = {
  sub: string;
  email: string;
};

export type AuthEnv = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, getJwtSecret());
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid token payload: missing sub or email");
  }
  return { sub: payload.sub, email: payload.email };
}

/**
 * Authenticate a Bearer token — tries JWT first, then API key.
 * Returns { userId, email } on success, null on failure.
 */
export async function authenticateBearer(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  // Try JWT first (fast, no DB hit)
  try {
    const payload = await verifyToken(token);
    return { userId: payload.sub, email: payload.email };
  } catch {
    // Not a valid JWT — try API key
  }

  // Try API key (sha256 hash → DB lookup)
  if (token.startsWith("tndy_")) {
    const hash = hashKey(token);
    const userId = await verifyApiKey(hash);
    if (userId) {
      // API keys don't carry email — set empty string
      return { userId, email: "" };
    }
  }

  return null;
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = header.slice(7);
  const auth = await authenticateBearer(token);
  if (!auth) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  c.set("userId", auth.userId);
  c.set("userEmail", auth.email);

  await next();
});
