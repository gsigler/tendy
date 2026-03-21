import { createMiddleware } from "hono/factory";
import * as jose from "jose";

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

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = header.slice(7);
  try {
    const payload = await verifyToken(token);
    c.set("userId", payload.sub);
    c.set("userEmail", payload.email);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
});
