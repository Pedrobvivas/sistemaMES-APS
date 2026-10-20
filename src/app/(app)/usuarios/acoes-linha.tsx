"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { normalizarPapel, papeis, rotuloPapel, type Papel } from "@/lib/papeis";
import { alterarPapel, removerUsuario } from "./actions";

export function AcoesUsuario({ id, nome, papel }: { id: string; nome: string; papel: string }) {
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <label htmlFor={`papel-${id}`} className="sr-only">
        Perfil de {nome}
      </label>
      <Select
        id={`papel-${id}`}
        className="h-9 w-40"
        defaultValue={normalizarPapel(papel)}
        disabled={pendente}
        onChange={(e) => {
          const novo = e.target.value as Papel;
          iniciar(() => alterarPapel(id, novo));
        }}
      >
        {papeis.map((p) => (
          <option key={p} value={p}>
            {rotuloPapel[p]}
          </option>
        ))}
      </Select>
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
