import "server-only";
import { db } from "@/db";
import { auditoria } from "@/db/schema";

type Executor = Pick<typeof db, "insert">;

// Registra uma ação relevante. Use dentro da mesma transação da alteração.
export async function registrarAuditoria(
  executor: Executor,
  dados: { entidade: string; entidadeId?: string | null; acao: string; resumo: string; usuarioId?: string | null; detalhes?: unknown },
) {
  await executor.insert(auditoria).values({
    entidade: dados.entidade,
    entidadeId: dados.entidadeId ?? null,
    acao: dados.acao,
    resumo: dados.resumo,
    dados: dados.detalhes ?? null,
    usuarioId: dados.usuarioId ?? null,
  });
}
