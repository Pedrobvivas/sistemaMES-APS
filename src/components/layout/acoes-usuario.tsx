"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Icone } from "./icone";

export function BotaoTema() {
  function alternar() {
    const atual = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const novo = atual === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label="Alternar tema claro e escuro"
      className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
    >
      <Icone nome="tema" />
    </button>
  );
}

export function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await authClient.signOut();
    router.push("/entrar");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={saindo}
      aria-label="Sair"
      className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
    >
      <Icone nome="sair" />
    </button>
  );
}
