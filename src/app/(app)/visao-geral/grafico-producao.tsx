"use client";

// Produção diária (produtos acabados): barras empilhadas boas + rejeitadas, com dica ao passar o mouse.
import { useState } from "react";
import { cn } from "@/lib/utils";

type Dia = { dia: string; boa: number; rejeitada: number };

const semana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function rotuloDia(iso: string, longo = false) {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  if (!longo) return dia;
  return `${semana[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]}, ${dia}`;
}

// Escala "bonita": 1, 2, 5 × 10^n acima do máximo.
function topoEscala(maximo: number) {
  if (maximo <= 0) return 4;
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * potencia >= maximo) return f * potencia;
  return 10 * potencia;
}

export function GraficoProducao({ dias }: { dias: Dia[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const topo = topoEscala(Math.max(...dias.map((d) => d.boa + d.rejeitada)));
  const marcas = [0, topo / 4, topo / 2, (3 * topo) / 4, topo];
  const total = dias.reduce((s, d) => s + d.boa + d.rejeitada, 0);
  const atual = foco !== null ? dias[foco] : null;

  if (total === 0) {
    return <p className="flex h-64 items-center justify-center text-sm text-muted">Nenhum produto acabado apontado nos últimos {dias.length} dias.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-64 pl-10" onMouseLeave={() => setFoco(null)}>
        {/* Grade e eixo Y (recessivos) */}
        {marcas.map((m) => (
          <div key={m} className="pointer-events-none absolute left-10 right-0 border-t border-borda/60" style={{ bottom: `${(m / topo) * 100}%` }}>
            <span className="absolute -left-10 -translate-y-1/2 font-mono text-[11px] text-muted">{m.toLocaleString("pt-BR")}</span>
          </div>
        ))}
        {/* Barras */}
        <div className="absolute inset-y-0 left-10 right-0 flex items-end gap-[3px]">
          {dias.map((d, i) => {
            const alturaBoa = (d.boa / topo) * 100;
            const alturaRej = (d.rejeitada / topo) * 100;
            return (
              <button
                key={d.dia}
                type="button"
                aria-label={`${rotuloDia(d.dia, true)}: ${d.boa} boas, ${d.rejeitada} rejeitadas`}
                onMouseEnter={() => setFoco(i)}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(null)}
                className={cn("relative flex h-full flex-1 flex-col justify-end rounded-sm", foco === i && "bg-surface/60")}
              >
                {d.rejeitada > 0 && (
                  <span className="mb-[2px] block w-full rounded-t-[4px] bg-serie-2" style={{ height: `${alturaRej}%`, minHeight: 2 }} />
                )}
                {d.boa > 0 && (
                  <span className={cn("block w-full bg-serie-1", d.rejeitada > 0 ? "rounded-none" : "rounded-t-[4px]")} style={{ height: `${alturaBoa}%`, minHeight: 2 }} />
                )}
              </button>
            );
          })}
        </div>
        {/* Dica */}
        {atual && foco !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-40 -translate-x-1/2 rounded-md border border-borda bg-surface px-3 py-2 text-xs shadow-lg"
            style={{ left: `calc(2.5rem + (100% - 2.5rem) * ${(foco + 0.5) / dias.length})` }}
          >
            <p className="mb-1 font-semibold">{rotuloDia(atual.dia, true)}</p>
            <p className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-serie-1" aria-hidden="true" /> Boas
              </span>
              <span className="font-mono font-semibold">{atual.boa}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-serie-2" aria-hidden="true" /> Rejeitadas
              </span>
              <span className="font-mono font-semibold">{atual.rejeitada}</span>
            </p>
          </div>
        )}
      </div>
      {/* Eixo X: um rótulo a cada 5 dias */}
      <div className="relative ml-10 h-4">
        {dias.map((d, i) =>
          i % 5 === 0 || i === dias.length - 1 ? (
            <span
              key={d.dia}
              className="absolute -translate-x-1/2 font-mono text-[11px] text-muted"
              style={{ left: `${((i + 0.5) / dias.length) * 100}%` }}
            >
              {rotuloDia(d.dia)}
            </span>
          ) : null,
        )}
      </div>
      <details className="text-xs text-muted">
        <summary className="inline-flex min-h-11 cursor-pointer items-center hover:text-ink">Ver dados em tabela</summary>
        <table className="mt-2 w-full max-w-md text-left">
          <thead>
            <tr>
              <th className="py-1 font-semibold">Dia</th>
              <th className="py-1 text-right font-semibold">Boas</th>
              <th className="py-1 text-right font-semibold">Rejeitadas</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.dia} className="border-t border-borda/60">
                <td className="py-1">{rotuloDia(d.dia, true)}</td>
                <td className="py-1 text-right font-mono text-ink">{d.boa}</td>
                <td className="py-1 text-right font-mono text-ink">{d.rejeitada}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
