import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Lido do arquivo .env (veja .env.example).
    url: process.env.DATABASE_URL ?? "",
  },
});
