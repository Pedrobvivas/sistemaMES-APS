import { cn } from "@/lib/utils";

// Tabela com rolagem horizontal em telas pequenas.
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-md border border-borda">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("border-b border-borda bg-surface-2 px-4 py-3 text-left font-semibold text-muted", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-borda px-4 py-3 align-middle", className)} {...props} />;
}
