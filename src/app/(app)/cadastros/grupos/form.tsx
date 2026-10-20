"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input, Select } from "@/components/ui/form";
import type { EstadoForm } from "@/lib/formularios";

type RecursoOpcao = { id: string; codigo: string; nome: string; centro: string };

export function FormGrupo({
  acao,
  grupo,
  recursos,
  membros,
}: {
  acao: (estado: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  grupo?: { codigo: string; nome: string };
  recursos: RecursoOpcao[];
  membros: Record<string, number>;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoForm, FormData>(acao, {});
  const erros = estado.erros ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {erros.geral && <Alerta>{erros.geral}</Alerta>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="codigo" rotulo="Código" erro={erros.codigo}>
          <Input id="codigo" name="codigo" defaultValue={grupo?.codigo} required aria-invalid={!!erros.codigo} />
        </Campo>
        <Campo id="nome" rotulo="Nome" erro={erros.nome}>
          <Input id="nome" name="nome" defaultValue={grupo?.nome} required aria-invalid={!!erros.nome} />
        </Campo>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Recursos que executam as operações deste grupo</legend>
        <p className="text-xs text-muted">O sequenciador escolhe o que termina mais cedo; em empate, o preferencial.</p>
        <ul className="flex max-h-80 flex-col divide-y divide-borda overflow-y-auto rounded-sm border border-borda">
          {recursos.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <label htmlFor={`membro-${r.id}`} className="min-w-0 text-sm">
                <span className="font-mono font-semibold">{r.codigo}</span> {r.nome}
                <span className="block text-xs text-muted">{r.centro}</span>
              </label>
              <Select id={`membro-${r.id}`} name={`membro-${r.id}`} defaultValue={String(membros[r.id] ?? "")} className="h-10 w-40 shrink-0">
                <option value="">Não participa</option>
                <option value="1">Preferencial</option>
                <option value="2">Alternativo</option>
              </Select>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
        {grupo && (
          <Link href="/cadastros/grupos" className={buttonClasses({ variante: "secundaria" })}>
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
