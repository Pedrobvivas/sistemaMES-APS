// Roda uma vez quando o servidor Next.js inicia.
export async function register() {
  // O import precisa ficar dentro deste `if` (e não depois de um `return`)
  // para o Next.js removê-lo do bundle do runtime edge, onde `postgres`
  // e `node:*` não existem.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.RUN_MIGRATIONS === "false") return;

    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
  }
}
