"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-mono text-sm text-muted">ALGO DEU ERRADO</p>
      <h1 className="text-3xl font-bold">Não conseguimos carregar esta página</h1>
      <p className="max-w-md text-muted">Tente de novo. Se o problema continuar, fale com o suporte.</p>
      {error.digest && <p className="font-mono text-xs text-muted">Código: {error.digest}</p>}
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
