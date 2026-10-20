"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Recarrega os dados do servidor a cada `segundos` enquanto a aba está visível.
// Simples e suficiente para o protótipo; em produção, trocar por eventos do servidor (SSE).
export function Atualizador({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
