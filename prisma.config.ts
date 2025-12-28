// Prisma configuration for RidePro API
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node prisma/seed.ts",
  },
  datasource: {
    // Connection pooling URL for queries
    url: env("DATABASE_URL"),
    // Note: directUrl is configured in schema.prisma, not here
  },
});
