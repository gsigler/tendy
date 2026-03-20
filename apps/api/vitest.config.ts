import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    env: {
      DATABASE_URL: "postgresql://tendy:tendy@localhost:5432/tendy",
      JWT_SECRET: "test-secret-for-vitest",
    },
  },
});
