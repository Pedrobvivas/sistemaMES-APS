import { cn } from "@/lib/utils";

type Variante = "primaria" | "secundaria" | "perigo" | "fantasma";
type Tamanho = "md" | "sm";

const variantes: Record<Variante, string> = {
  primaria: "bg-primaria text-primaria-texto hover:bg-primaria-hover",
  secundaria: "border border-borda bg-surface-2 text-ink hover:border-muted",
  perigo: "bg-erro text-surface hover:opacity-90",
  fantasma: "text-ink hover:bg-surface-2",
};

const tamanhos: Record<Tamanho, string> = {
  md: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-sm",
};

// Classes do botão, para usar também em <Link> com cara de botão.
export function buttonClasses({
  variante = "primaria",
  tamanho = "md",
  className,
}: { variante?: Variante; tamanho?: Tamanho; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    variantes[variante],
    tamanhos[tamanho],
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamanho?: Tamanho;
};

export function Button({ variante, tamanho, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variante, tamanho, className })} {...props} />;
}
