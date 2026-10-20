"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icone } from "@/components/layout/icone";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { gerarAcao } from "./actions";

export function BotaoGerar() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await gerarAcao();
            if (!r.ok) return setErro(r.erro);
            router.push(`/programacao?versao=${r.programacaoId}`);
          })
        }
      >
        <Icone nome="programacao" tamanho={18} /> {pendente ? "Gerando..." : "Gerar programação"}
      </Button>
      {erro && <Alerta>{erro}</Alerta>}
    </div>
  );
}
