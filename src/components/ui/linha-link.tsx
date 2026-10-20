"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// Linha de tabela que abre o registro ao clicar em qualquer parte dela.
// O link do código continua existindo (teclado, leitor de tela e "abrir em nova aba").
export function LinhaLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className={cn("cursor-pointer hover:bg-surface-2", className)}
      onClick={(e) => {
        // Cliques em links, botões e campos dentro da linha seguem o próprio elemento.
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
        // Ctrl/Cmd + clique abre em nova aba, como num link comum.
        if (e.metaKey || e.ctrlKey) {
          window.open(href, "_blank");
          return;
        }
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
