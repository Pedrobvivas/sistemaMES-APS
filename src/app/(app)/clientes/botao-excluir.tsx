"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { excluirCliente } from "./actions";

export function BotaoExcluirCliente({ id, nome }: { id: string; nome: string }) {
  const [pendente, iniciar] = useTransition();

  function excluir() {
    if (!confirm(`Excluir "${nome}"? Essa ação não pode ser desfeita.`)) return;
    iniciar(() => excluirCliente(id));
  }

  return (
    <Button variante="perigo" onClick={excluir} disabled={pendente}>
      {pendente ? "Excluindo..." : "Excluir cliente"}
    </Button>
  );
}
