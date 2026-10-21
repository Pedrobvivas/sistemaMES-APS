import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  entregasNoPrazo,
  minutosNaJanela,
  producaoPorDia,
  razao,
  variacaoPercentual,
  variacaoPontos,
} from "../../src/domain/indicadores/visao-geral.ts";
import { FUSO, t } from "./ajuda.ts";

describe("visão geral", () => {
  it("não divide por zero", () => {
    assert.equal(razao(3, 0), null);
    assert.equal(razao(3, 4), 0.75);
  });

  it("variação percentual só existe com base no período anterior", () => {
    assert.equal(variacaoPercentual(10, 0), null);
    assert.equal(variacaoPercentual(null, 5), null);
    const v = variacaoPercentual(110, 100);
    assert.ok(v && v.tipo === "percentual" && Math.abs(v.valor - 10) < 1e-9);
  });

  it("variação de taxa em pontos percentuais", () => {
    assert.equal(variacaoPontos(0.9, null), null);
    const v = variacaoPontos(0.95, 0.9);
    assert.ok(v && Math.abs(v.valor - 5) < 1e-9);
  });

  it("entregas no prazo comparam término real com o fim do dia de entrega", () => {
    const fimDia26 = t("2026-10-26", "23:59");
    const r = entregasNoPrazo([
      { termino: t("2026-10-26", "16:00"), prazoFim: fimDia26 },
      { termino: t("2026-10-27", "08:00"), prazoFim: fimDia26 },
    ]);
    assert.deepEqual(r, { noPrazo: 1, total: 2, taxa: 0.5 });
    assert.equal(entregasNoPrazo([]).taxa, null);
  });

  it("produção por dia preenche dias vazios e respeita o fuso", () => {
    const dias = producaoPorDia(
      [
        { ocorridoEm: t("2026-10-26", "23:30"), boa: 2, rejeitada: 0 }, // ainda dia 26 em São Paulo
        { ocorridoEm: t("2026-10-28", "09:00"), boa: 1, rejeitada: 1 },
        { ocorridoEm: t("2026-10-01", "09:00"), boa: 9, rejeitada: 0 }, // fora da janela
      ],
      "2026-10-28",
      3,
      FUSO,
    );
    assert.deepEqual(dias, [
      { dia: "2026-10-26", boa: 2, rejeitada: 0 },
      { dia: "2026-10-27", boa: 0, rejeitada: 0 },
      { dia: "2026-10-28", boa: 1, rejeitada: 1 },
    ]);
  });

  it("minutos dentro da janela recortam os trechos", () => {
    const de = t("2026-10-26", "08:00");
    const ate = t("2026-10-26", "12:00");
    assert.equal(
      minutosNaJanela(
        [
          { inicio: t("2026-10-26", "07:00"), fim: t("2026-10-26", "09:00") },
          { inicio: t("2026-10-26", "11:30"), fim: t("2026-10-26", "14:00") },
        ],
        de,
        ate,
      ),
      90,
    );
  });
});
