import crypto from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";

/**
 * Generate a random API key with a "tndy_" prefix.
 * Format: tndy_<40 random hex chars>
 */
function generateKey(): { raw: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(20).toString("hex");
  const raw = `tndy_${random}`;
  const prefix = raw.slice(0, 8); // "tndy_xxx" — enough to identify the key
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

/** Hash a raw API key for lookup. */
export function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function create(userId: string, name: string) {
  const { raw, prefix, hash } = generateKey();

  const [key] = await db
    .insert(apiKeys)
    .values({ userId, name, prefix, keyHash: hash })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt,
    });

  // Return the raw key ONCE — it cannot be retrieved again
  return { ...key, key: raw };
}

export async function list(userId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt);
}

/**
 * Look up a valid (non-revoked, non-expired) API key by its hash.
 * Returns the userId if valid, null otherwise.
 * Also updates lastUsedAt on successful lookup.
 */
export async function verify(keyHash: string): Promise<string | null> {
  const [row] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId, expiresAt: apiKeys.expiresAt, revokedAt: apiKeys.revokedAt })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) return null;

  // Check expiration
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  // Update lastUsedAt (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .then(() => {});

  return row.userId;
}

export async function revoke(userId: string, keyId: string) {
  const [key] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id, name: apiKeys.name, revokedAt: apiKeys.revokedAt });

  return key ?? null;
}
