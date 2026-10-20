import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// A conexão só abre na primeira consulta, então o build funciona sem banco.
const connectionString = process.env.DATABASE_URL ?? "postgres://localhost:5432/sem-database-url";

// Reaproveita a conexão entre recarregamentos do servidor em desenvolvimento.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client = globalForDb.pg ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema });
