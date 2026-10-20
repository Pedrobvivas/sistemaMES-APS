import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-mono text-sm text-muted">ERRO 404</p>
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <p className="max-w-md text-muted">O endereço pode ter mudado ou não existe mais.</p>
      <Link href="/painel" className={buttonClasses()}>
        Voltar ao painel
      </Link>
    </main>
  );
}
