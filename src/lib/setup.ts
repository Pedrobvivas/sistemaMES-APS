import "server-only";
import { connection } from "next/server";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";

// Verdadeiro enquanto o sistema não tem nenhum usuário (primeiro acesso).
export async function precisaConfigurar() {
  // Força a página a ser dinâmica: sem isso o Next.js tenta consultar o banco
  // durante o `next build`, que não tem banco (ex.: build da imagem Docker).
  await connection();
  const [{ total }]= await db.select({ total: count() }).from(user);
  return total === 0;
}
