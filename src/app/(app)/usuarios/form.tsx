"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input, Select } from "@/components/ui/form";
import { papeis, rotuloPapel } from "@/lib/papeis";
import { criarUsuario, type EstadoUsuario } from "./actions";

export function FormNovoUsuario() {
  const [estado, acao, enviando] = useActionState<EstadoUsuario, FormData>(criarUsuario, {});
  const form = useRef<HTMLFormElement>(null);
  const erros = estado.erros ?? {};

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={acao} className="flex flex-col gap-4">
      {erros.geral && <Alerta>{erros.geral}</Alerta>}
      {estado.ok && <Alerta tom="sucesso">Usuário criado. Passe o e-mail e a senha para a pessoa.</Alerta>}
      <Campo id="nome" rotulo="Nome" erro={erros.nome}>
        <Input id="nome" name="nome" required aria-invalid={!!erros.nome} />
      </Campo>
      <Campo id="email" rotulo="E-mail" erro={erros.email}>
        <Input id="email" name="email" type="email" required aria-invalid={!!erros.email} />
      </Campo>
      <Campo id="senha" rotulo="Senha inicial" erro={erros.senha} ajuda="A pessoa pode trocar depois em “Esqueci minha senha”.">
        <Input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required />
      </Campo>
      <Campo id="papel" rotulo="Perfil" erro={erros.papel} ajuda="Planejador: ordens, cadastros e programação. Operador: só o terminal de produção.">
        <Select id="papel" name="papel" defaultValue="operador">
          {papeis.map((p) => (
            <option key={p} value={p}>
              {rotuloPapel[p]}
            </option>
          ))}
        </Select>
      </Campo>
      <Button type="submit" disabled={enviando}>
        {enviando ? "Criando..." : "Criar usuário"}
      </Button>
    </form>
  );
}
