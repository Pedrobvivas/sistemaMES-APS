import { z } from "zod";

// Estado devolvido pelas server actions de formulário.
export type EstadoForm = { ok?: boolean; mensagem?: string; erros?: Record<string, string | undefined> };

export function errosZod(erro: z.ZodError): EstadoForm {
  const campos = erro.flatten().fieldErrors as Record<string, string[] | undefined>;
  const geral = erro.flatten().formErrors[0];
  return { erros: { ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v?.[0]])), ...(geral ? { geral } : {}) } };
}

export const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

export const codigo = z
  .string()
  .trim()
  .min(1, "Informe o código.")
  .max(30, "Máximo de 30 caracteres.")
  .transform((v) => v.toUpperCase());

export const inteiro = (rotulo: string, min = 0) =>
  z.coerce.number({ invalid_type_error: `${rotulo}: informe um número.` }).int(`${rotulo}: use um número inteiro.`).min(min, `${rotulo}: mínimo ${min}.`);

export const decimal = (rotulo: string, min = 0) =>
  z.coerce.number({ invalid_type_error: `${rotulo}: informe um número.` }).min(min, `${rotulo}: mínimo ${min}.`);

export const caixa = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

// Traduz erros do Postgres (diretos ou embrulhados pelo Drizzle) para o usuário.
export function mensagemErroBanco(e: unknown, padrao = "Não foi possível salvar. Tente novamente.") {
  const erro = e as { code?: string; cause?: { code?: string; constraint_name?: string } };
  const codigoErro = erro?.code ?? erro?.cause?.code;
  if (codigoErro === "23505") return "Já existe um registro com este código ou nome.";
  if (codigoErro === "23503") return "Este registro está em uso por outros cadastros e não pode ser removido. Desative-o.";
  if (codigoErro === "23514") return "Valores fora das regras do cadastro.";
  console.error(e);
  return padrao;
}

// "07:30" → 450
export function horaParaMinutos(hhmm: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

export function minutosParaHora(min: number) {
  const h = Math.floor(min / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
