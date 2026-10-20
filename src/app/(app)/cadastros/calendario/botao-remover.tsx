"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function BotaoRemover({ acao, pergunta, rotulo }: { acao: () => Promise<void>; pergunta: string; rotulo: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      tamanho="sm"
      variante="fantasma"
      disabled={pendente}
      aria-label={rotulo}
      onClick={() => {
        if (confirm(pergunta)) iniciar(() => acao());
      }}
    >
      {pendente ? "Removendo..." : "Remover"}
    </Button>
  );
}
