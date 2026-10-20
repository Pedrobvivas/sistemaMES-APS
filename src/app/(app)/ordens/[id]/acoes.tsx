"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icone } from "@/components/layout/icone";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input } from "@/components/ui/form";
import { cancelar, liberar, type EstadoAcaoOrdem } from "../actions";

export function AcoesOrdem({ id, status, podeEditar }: { id: string; status: string; podeEditar: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [estado, setEstado] = useState<EstadoAcaoOrdem>({});
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {status === "rascunho" && (
          <Button disabled={pendente} onClick={() => iniciar(async () => setEstado(await liberar(id)))}>
            <Icone nome="programacao" tamanho={18} />
            {pendente ? "Liberando..." : "Liberar para produção"}
          </Button>
        )}
        {podeEditar && (
          <Link href={`/ordens/${id}/editar`} className={buttonClasses({ variante: "secundaria" })}>
            Editar
          </Link>
        )}
        {(status === "liberada" || status === "em_execucao") && (
          <Link href="/programacao" className={buttonClasses({ variante: "secundaria" })}>
            Ver no Gantt
          </Link>
        )}
        {(status === "rascunho" || status === "liberada") && !cancelando && (
          <Button variante="fantasma" onClick={() => setCancelando(true)}>
            Cancelar OP
          </Button>
        )}
      </div>
      {cancelando && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-md border border-borda p-3"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await cancelar(id, motivo);
              setEstado(r);
              if (r.ok) setCancelando(false);
            });
          }}
        >
          <div className="min-w-64 flex-1">
            <Campo id="motivo-cancelamento" rotulo="Motivo do cancelamento">
              <Input id="motivo-cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={3} />
            </Campo>
          </div>
          <Button type="submit" variante="perigo" disabled={pendente}>
            Confirmar cancelamento
          </Button>
          <Button variante="secundaria" onClick={() => setCancelando(false)}>
            Voltar
          </Button>
        </form>
      )}
      {estado.erro && <Alerta>{estado.erro}</Alerta>}
      {estado.ok && <Alerta tom="sucesso">{estado.ok}</Alerta>}
    </div>
  );
}
