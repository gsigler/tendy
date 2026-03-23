import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { signToken } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { RegisterRequestSchema, LoginRequestSchema } from "@tendy/shared";

export const auth = new Hono();

// 10 attempts per 15 minutes per IP
const authRateLimit = rateLimit({ limit: 10, windowMs: 15 * 60 * 1000 });

auth.post("/v1/auth/register", authRateLimit, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = RegisterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400,
    );
  }

  const { email, password, name } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  let user: { id: string; email: string; name: string };
  try {
    [user] = await db
      .insert(users)
      .values({ email, name, passwordHash })
      .returning({ id: users.id, email: users.email, name: users.name });
  } catch (err: unknown) {
    const pgError =
      err instanceof Error && "cause" in err ? err.cause : err;
    if (
      typeof pgError === "object" &&
      pgError !== null &&
      "code" in pgError &&
      (pgError as { code: string }).code === "23505"
    ) {
      return c.json({ error: "Email already registered" }, 409);
    }
    throw err;
  }

  const token = await signToken({ sub: user.id, email: user.email });

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } }, 201);
});

auth.post("/v1/auth/login", authRateLimit, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400,
    );
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = await signToken({ sub: user.id, email: user.email });

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});
