"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alerta } from "@/components/ui/feedback";
import { Campo, Input } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

function FormRedefinir() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!token) {
    return <Alerta>Link inválido ou expirado. Peça um novo na tela de recuperação de senha.</Alerta>;
  }

  async function redefinir(formData: FormData) {
    const senha = String(formData.get("senha"));
    if (senha !== String(formData.get("confirmacao"))) {
      setErro("As senhas não são iguais.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const { error } = await authClient.resetPassword({ newPassword: senha, token: token! });
    if (error) {
      setErro("Não foi possível redefinir. O link pode ter expirado.");
      setEnviando(false);
      return;
    }
    router.push("/entrar");
  }

  return (
    <form action={redefinir} className="flex flex-col gap-4">
      {erro && <Alerta>{erro}</Alerta>}
      <Campo id="senha" rotulo="Nova senha" ajuda="Mínimo de 8 caracteres.">
        <Input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required />
      </Campo>
      <Campo id="confirmacao" rotulo="Repita a nova senha">
        <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
      </Campo>
      <Button type="submit" disabled={enviando}>
        {enviando ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Criar nova senha</h1>
      <Suspense>
        <FormRedefinir />
      </Suspense>
      <Link href="/entrar" className="text-center text-sm text-destaque hover:underline">
        Voltar para o login
      </Link>
    </div>
  );
}
