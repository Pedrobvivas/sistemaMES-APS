"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

export default function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(formData: FormData) {
    setEnviando(true);
    // A resposta é a mesma exista o e-mail ou não, para não revelar quem tem conta.
    await authClient.requestPasswordReset({
      email: String(formData.get("email")),
      redirectTo: "/redefinir-senha",
    });
    setEnviado(true);
    setEnviando(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Recuperar senha</h1>
        <p className="text-sm text-muted">Enviamos um link para você criar uma nova senha.</p>
      </div>
      {enviado ? (
        <Alerta tom="sucesso">Se o e-mail estiver cadastrado, o link chega em alguns minutos.</Alerta>
      ) : (
        <form action={enviar} className="flex flex-col gap-4">
          <Campo id="email" rotulo="E-mail">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Campo>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar link"}
          </Button>
        </form>
      )}
      <Link href="/entrar" className="text-center text-sm text-destaque hover:underline">
        Voltar para o login
      </Link>
    </div>
  );
}
