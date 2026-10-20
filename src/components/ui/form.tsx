import { cn } from "@/lib/utils";

const baseCampo =
  "w-full rounded-sm border border-borda bg-surface px-3 text-sm text-ink placeholder:text-muted " +
  "focus:border-azul-eletrico focus:outline-none aria-[invalid=true]:border-erro";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(baseCampo, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(baseCampo, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(baseCampo, "h-11", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold text-ink", className)} {...props} />;
}

// Rótulo + campo + mensagem de erro, já ligados para leitores de tela.
export function Campo({
  id,
  rotulo,
  erro,
  ajuda,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {ajuda && !erro && <p className="text-xs text-muted">{ajuda}</p>}
      {erro && (
        <p id={`${id}-erro`} className="text-xs text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
