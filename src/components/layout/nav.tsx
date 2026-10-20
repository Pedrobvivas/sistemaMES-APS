"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icone } from "./icone";
import type { ItemMenu } from "./menu";

export function Nav({ itens }: { itens: ItemMenu[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1">
      {itens.map((item) => {
        const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              ativo ? "bg-primaria text-primaria-texto" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            <Icone nome={item.icone} />
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
