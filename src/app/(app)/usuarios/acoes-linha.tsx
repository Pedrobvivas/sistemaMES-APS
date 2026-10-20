"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { alterarPapel, removerUsuario } from "./actions";

export function AcoesUsuario({ id, nome, papel }: { id: string; nome: string; papel: string }) {
  const [pendente, iniciar] = useTransition();
  const ehAdmin = papel === "admin";

  return (
    <div className="flex justify-end gap-2">
      <Button
        tamanho="sm"
        variante="secundaria"
        disabled={pendente}
        onClick={() => iniciar(() => alterarPapel(id, ehAdmin ? "user" : "admin"))}
      >
        {ehAdmin ? "Tornar usuário" : "Tornar admin"}
      </Button>
      <Button
        tamanho="sm"
        variante="fantasma"
        disabled={pendente}
        onClick={() => {
          if (confirm(`Remover o acesso de "${nome}"?`)) iniciar(() => removerUsuario(id));
        }}
      >
        Remover
      </Button>
    </div>
  );
}
