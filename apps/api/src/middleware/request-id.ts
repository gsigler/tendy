import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";

export const requestId = createMiddleware(async (c, next) => {
  const id = c.req.header("X-Request-Id") || randomUUID().slice(0, 8);
  c.set("requestId", id);
  c.header("X-Request-Id", id);
  await next();
});
