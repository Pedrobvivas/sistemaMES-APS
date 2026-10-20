"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input } from "@/components/ui/form";
import { criarPrimeiroAdmin, type EstadoConfigurar } from "./actions";

export function FormConfigurar() {
  const [estado, acao, enviando] = useActionState<EstadoConfigurar, FormData>(criarPrimeiroAdmin, {});
  const erros = estado.erros ?? {};

  return (
    <form action={acao} className="flex flex-col gap-4">
      {erros.geral && <Alerta>{erros.geral}</Alerta>}
      <Campo id="nome" rotulo="Seu nome" erro={erros.nome}>
        <Input id="nome" name="nome" autoComplete="name" required aria-invalid={!!erros.nome} />
      </Campo>
      <Campo id="email" rotulo="E-mail" erro={erros.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!erros.email} />
      </Campo>
      <Campo id="senha" rotulo="Senha" erro={erros.senha} ajuda="Mínimo de 8 caracteres.">
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={!!erros.senha}
        />
      </Campo>
      <Button type="submit" disabled={enviando}>
        {enviando ? "Criando..." : "Criar administrador"}
      </Button>
    </form>
  );
}
