"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input } from "@/components/ui/form";
import type { EstadoForm } from "@/lib/formularios";
import { diasDaSemana } from "@/lib/rotulos";

export function FormTurno({
  acao,
  turno,
}: {
  acao: (estado: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  turno?: { nome: string; ativo: boolean; dias: number[]; periodos: { inicio: string; fim: string }[]; variaPorDia: boolean };
}) {
  const [estado, enviar, enviando] = useActionState<EstadoForm, FormData>(acao, {});
  const erros = estado.erros ?? {};
  const dias = turno?.dias ?? [1, 2, 3, 4, 5];
  const periodos = turno?.periodos ?? [
    { inicio: "07:00", fim: "12:00" },
    { inicio: "13:00", fim: "17:00" },
  ];

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {erros.geral && <Alerta>{erros.geral}</Alerta>}
      {turno?.variaPorDia && (
        <Alerta tom="alerta">Este turno tem horários diferentes por dia. Ao salvar, os períodos abaixo valem para todos os dias marcados.</Alerta>
      )}
      <Campo id="nome" rotulo="Nome" erro={erros.nome}>
        <Input id="nome" name="nome" defaultValue={turno?.nome} required aria-invalid={!!erros.nome} />
      </Campo>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Dias de trabalho</legend>
        <div className="flex flex-wrap gap-2">
          {diasDaSemana.map((rotulo, d) => (
            <label key={d} className="flex h-11 cursor-pointer items-center gap-2 rounded-sm border border-borda px-3 text-sm has-[:checked]:border-acento has-[:checked]:text-destaque">
              <input type="checkbox" name="dia" value={d} defaultChecked={dias.includes(d)} className="h-4 w-4 accent-[var(--acento)]" />
              {rotulo}
            </label>
          ))}
        </div>
        {erros.dias && <p className="mt-1 text-xs text-erro">{erros.dias}</p>}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Períodos de trabalho</legend>
        <p className="text-xs text-muted">Deixe em branco os que não usar. Se o fim for menor que o início, o período termina no dia seguinte.</p>
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-2 gap-3">
            <Campo id={`inicio${i}`} rotulo={`Início ${i}`} erro={erros[`periodo${i}`]}>
              <Input id={`inicio${i}`} name={`inicio${i}`} type="time" defaultValue={periodos[i - 1]?.inicio ?? ""} />
            </Campo>
            <Campo id={`fim${i}`} rotulo={`Fim ${i}`}>
              <Input id={`fim${i}`} name={`fim${i}`} type="time" defaultValue={periodos[i - 1]?.fim ?? ""} />
            </Campo>
          </div>
        ))}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="ativo" defaultChecked={turno?.ativo ?? true} className="h-5 w-5 accent-[var(--acento)]" />
        Ativo
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
        {turno && (
          <Link href="/cadastros/turnos" className={buttonClasses({ variante: "secundaria" })}>
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
