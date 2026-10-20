"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import type { Cliente } from "@/db/schema";
import { salvarCliente, type EstadoCliente } from "./actions";

// Mesmo formulário para criar (sem cliente) e editar (com cliente).
export function FormCliente({ cliente }: { cliente?: Cliente }) {
  const [estado, acao, enviando] = useActionState<EstadoCliente, FormData>(
    salvarCliente.bind(null, cliente?.id ?? null),
    {},
  );
  const erros = estado.erros ?? {};

  return (
    <form action={acao} className="flex max-w-2xl flex-col gap-5">
      {erros.geral && <Alerta>{erros.geral}</Alerta>}

      <Campo id="nome" rotulo="Nome" erro={erros.nome}>
        <Input id="nome" name="nome" defaultValue={cliente?.nome} required aria-invalid={!!erros.nome} />
      </Campo>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo id="email" rotulo="E-mail" erro={erros.email}>
          <Input id="email" name="email" type="email" defaultValue={cliente?.email ?? ""} aria-invalid={!!erros.email} />
        </Campo>
        <Campo id="telefone" rotulo="Telefone / WhatsApp" erro={erros.telefone}>
          <Input id="telefone" name="telefone" type="tel" defaultValue={cliente?.telefone ?? ""} />
        </Campo>
      </div>

      <Campo id="status" rotulo="Status" erro={erros.status}>
        <Select id="status" name="status" defaultValue={cliente?.status ?? "ativo"}>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </Select>
      </Campo>

      <Campo id="observacoes" rotulo="Observações" erro={erros.observacoes}>
        <Textarea id="observacoes" name="observacoes" defaultValue={cliente?.observacoes ?? ""} />
      </Campo>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
        <Link href="/clientes" className={buttonClasses({ variante: "secundaria" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
