import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { precisaConfigurar } from "@/lib/setup";
import { FormEntrar } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage() {
  if (await precisaConfigurar()) redirect("/configurar");
  if (await getSession()) redirect("/painel");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Entrar</h1>
        <p className="text-sm text-muted">Use o e-mail e a senha cadastrados.</p>
      </div>
      <FormEntrar />
    </div>
  );
}
