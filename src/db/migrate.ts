import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Aplica as migrations da pasta /drizzle. Chamado ao iniciar o servidor
// (src/instrumentation.ts). Seguro rodar várias vezes: só aplica o que falta.
export async function runMigrations() {
  const url = process.env.DATABASE_URL;
  const folder = path.join(process.cwd(), "drizzle");

  if (!url) {
    console.warn("[migrations] DATABASE_URL não definida; pulando.");
    return;
  }
  if (!fs.existsSync(path.join(folder, "meta", "_journal.json"))) {
    console.warn("[migrations] Nenhuma migration encontrada. Rode `npm run db:generate`.");
    return;
  }

  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: folder });
    console.log("[migrations] Banco atualizado.");
  } finally {
    await client.end();
  }
}
