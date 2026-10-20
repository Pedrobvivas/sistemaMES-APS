"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

export function FormEntrar() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(formData: FormData) {
    setEnviando(true);
    setErro(null);
    const { error } = await authClient.signIn.email({
      email: String(formData.get("email")),
      password: String(formData.get("senha")),
    });
    if (error) {
      setErro("E-mail ou senha incorretos.");
      setEnviando(false);
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <form action={entrar} className="flex flex-col gap-4">
      {erro && <Alerta>{erro}</Alerta>}
      <Campo id="email" rotulo="E-mail">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Campo>
      <Campo id="senha" rotulo="Senha">
        <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </Campo>
      <Button type="submit" disabled={enviando}>
        {enviando ? "Entrando..." : "Entrar"}
      </Button>
      <Link href="/esqueci-senha" className="text-center text-sm text-destaque hover:underline">
        Esqueci minha senha
      </Link>
    </form>
  );
}
