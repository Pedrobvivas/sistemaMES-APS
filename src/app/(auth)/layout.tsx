import { Marca } from "@/components/layout/marca";
import { appName } from "@/lib/utils";

// Telas de acesso (login, recuperação de senha, configuração inicial).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Marca tamanho={56} />
          <p className="font-display text-2xl font-bold">{appName}</p>
          <p className="text-sm text-muted">Camargo TI · Technology Intelligence</p>
        </div>
        <div className="rounded-md border border-borda bg-surface-2 p-6">{children}</div>
      </div>
    </main>
  );
}
