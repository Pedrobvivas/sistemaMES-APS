"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import type { EstadoForm } from "@/lib/formularios";
import { cn } from "@/lib/utils";

export type CampoConfig = {
  nome: string;
  rotulo: string;
  tipo?: "texto" | "numero" | "select" | "caixa" | "data" | "datahora" | "area" | "hora";
  opcoes?: { valor: string; rotulo: string }[];
  valor?: string | number | boolean | null;
  obrigatorio?: boolean;
  ajuda?: string;
  passo?: string;
  min?: number;
  largura?: "metade" | "inteira";
  desabilitado?: boolean;
};

// Formulário de cadastro: campos declarados, validação e erros vindos da server action.
export function FormCadastro({
  acao,
  campos,
  rotuloBotao = "Salvar",
  cancelarHref,
  idPrefixo = "campo",
}: {
  acao: (estado: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  campos: CampoConfig[];
  rotuloBotao?: string;
  cancelarHref?: string;
  idPrefixo?: string; // para dois formulários na mesma página
}) {
  const [estado, enviar, enviando] = useActionState<EstadoForm, FormData>(acao, {});
  const erros = estado.erros ?? {};

  return (
    <form action={enviar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {erros.geral && <Alerta className="sm:col-span-2">{erros.geral}</Alerta>}
      {estado.ok && estado.mensagem && (
        <Alerta tom="sucesso" className="sm:col-span-2">
          {estado.mensagem}
        </Alerta>
      )}
      {campos.map((c) => {
        const id = `${idPrefixo}-${c.nome}`;
        const comum = {
          id,
          name: c.nome,
          required: c.obrigatorio,
          disabled: c.desabilitado,
          "aria-invalid": !!erros[c.nome],
          "aria-describedby": erros[c.nome] ? `${id}-erro` : undefined,
        };
        const largura = c.largura === "metade" ? "" : "sm:col-span-2";
        if (c.tipo === "caixa") {
          return (
            <div key={c.nome} className={cn("flex min-h-11 items-center gap-3", largura)}>
              <input type="checkbox" {...comum} required={false} defaultChecked={!!c.valor} className="h-5 w-5 accent-[var(--azul-eletrico)]" />
              <label htmlFor={id} className="text-sm font-semibold">
                {c.rotulo}
              </label>
            </div>
          );
        }
        return (
          <div key={c.nome} className={largura}>
            <Campo id={id} rotulo={c.rotulo} erro={erros[c.nome]} ajuda={c.ajuda}>
              {c.tipo === "select" ? (
                <Select {...comum} defaultValue={c.valor == null ? "" : String(c.valor)}>
                  {!c.obrigatorio && <option value="">—</option>}
                  {c.opcoes?.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Select>
              ) : c.tipo === "area" ? (
                <Textarea {...comum} defaultValue={c.valor == null ? "" : String(c.valor)} />
              ) : (
                <Input
                  {...comum}
                  type={
                    c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : c.tipo === "datahora" ? "datetime-local" : c.tipo === "hora" ? "time" : "text"
                  }
                  step={c.passo}
                  min={c.min}
                  inputMode={c.tipo === "numero" ? "decimal" : undefined}
                  defaultValue={c.valor == null ? "" : String(c.valor)}
                />
              )}
            </Campo>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : rotuloBotao}
        </Button>
        {cancelarHref && (
          <Link href={cancelarHref} className={buttonClasses({ variante: "secundaria" })}>
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
