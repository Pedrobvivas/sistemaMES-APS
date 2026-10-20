import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { precisaConfigurar } from "@/lib/setup";
import { FormConfigurar } from "./form";

export const metadata: Metadata = { title: "Configuração inicial" };

export default async function ConfigurarPage() {
  // Depois do primeiro usuário criado, esta tela deixa de existir na prática.
  if (!(await precisaConfigurar())) redirect("/entrar");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Configuração inicial</h1>
        <p className="text-sm text-muted">
          Crie o primeiro administrador. Depois, ele cadastra os outros usuários.
        </p>
      </div>
      <FormConfigurar />
    </div>
  );
}
