import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/ui/feedback";
import { requireSession } from "@/lib/session";
import { FormCliente } from "../form";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoClientePage() {
  await requireSession();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Novo cliente" />
      <FormCliente />
    </div>
  );
}
