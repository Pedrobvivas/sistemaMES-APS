import { cn } from "@/lib/utils";

type Tom = "neutro" | "sucesso" | "erro" | "destaque";

const tonsBadge: Record<Tom, string> = {
  neutro: "border-borda text-muted",
  sucesso: "border-sucesso/40 text-sucesso",
  erro: "border-erro/40 text-erro",
  destaque: "border-destaque/40 text-destaque",
};

export function Badge({ tom = "neutro", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tom?: Tom }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", tonsBadge[tom], className)}
      {...props}
    />
  );
}

export function Alerta({ tom = "erro", className, ...props }: React.HTMLAttributes<HTMLDivElement> & { tom?: Tom }) {
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className={cn("rounded-sm border bg-surface-2 px-4 py-3 text-sm", tonsBadge[tom], className)}
      {...props}
    />
  );
}

export function Vazio({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-borda px-6 py-16 text-center">
      <p className="font-display text-lg font-bold">{titulo}</p>
      {descricao && <p className="max-w-sm text-sm text-muted">{descricao}</p>}
      {acao}
    </div>
  );
}

// Título da página com ações à direita (ex.: botão "Novo cliente").
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{titulo}</h1>
        {descricao && <p className="text-sm text-muted">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}
