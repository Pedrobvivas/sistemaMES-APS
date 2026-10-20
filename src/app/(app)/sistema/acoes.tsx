"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { carregarDemonstracaoAcao, removerDemonstracaoAcao } from "./actions";

export function AcoesDemonstracao({ carregada }: { carregada: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tom: "erro" | "sucesso"; texto: string } | null>(null);

  function rodar(acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string, pergunta: string) {
    if (!confirm(pergunta)) return;
    setAviso(null);
    iniciar(async () => {
      const r = await acao();
      setAviso(r.ok ? { tom: "sucesso", texto: sucesso } : { tom: "erro", texto: r.erro ?? "Falhou." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pendente}
          onClick={() =>
            rodar(
              carregarDemonstracaoAcao,
              "Dados de demonstração carregados e programação aprovada. Abra o Gantt.",
              carregada
                ? "Recarregar apaga os dados de demonstração atuais (inclusive apontamentos feitos neles) e cria de novo. Continuar?"
                : "Carregar a fábrica fictícia de quadros elétricos? Só funciona com a base industrial vazia.",
            )
          }
        >
          {pendente ? "Processando..." : carregada ? "Recarregar demonstração" : "Carregar demonstração"}
        </Button>
        {carregada && (
          <Button
            variante="perigo"
            disabled={pendente}
            onClick={() => rodar(removerDemonstracaoAcao, "Dados de demonstração removidos.", "Apagar todos os cadastros, OPs e apontamentos da demonstração?")}
          >
            Remover demonstração
          </Button>
        )}
      </div>
      {aviso && <Alerta tom={aviso.tom}>{aviso.texto}</Alerta>}
    </div>
  );
}
