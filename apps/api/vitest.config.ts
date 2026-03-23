import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://tendy:tendy@172.17.0.5:5432/tendy",
      JWT_SECRET: "test-secret-for-vitest",
    },
  },
});
