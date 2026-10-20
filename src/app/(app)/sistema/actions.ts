"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/session";
import { carregarDemonstracao, removerDemonstracao } from "@/server/demonstracao";

export async function carregarDemonstracaoAcao() {
  const { user } = await exigirPermissao("sistema:administrar");
  try {
    const r = await carregarDemonstracao(user.id);
    revalidatePath("/", "layout");
    return r.ok ? { ok: true } : { ok: false, erro: r.erro };
  } catch (e) {
    console.error(e);
    return { ok: false, erro: "Falha ao carregar a demonstração. Veja o log do servidor." };
  }
}

export async function removerDemonstracaoAcao() {
  const { user } = await exigirPermissao("sistema:administrar");
  const r = await removerDemonstracao(user.id);
  revalidatePath("/", "layout");
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}
