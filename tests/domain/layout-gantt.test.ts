import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALTURA_FAIXA,
  ALTURA_GRUPO,
  ALTURA_SUBLINHA,
  FILTROS_VAZIOS,
  MARGEM_BARRA,
  SEM_CLIENTE,
  montarLayout,
  type BarraLayout,
  type RecursoLayout,
} from "../../src/domain/aps/layout-gantt.ts";
import { FUSO, t } from "./ajuda.ts";

const recursos: RecursoLayout[] = [
  { id: "R1", codigo: "MEC-A", nome: "Montador A", centroId: "C1", centroNome: "Montagem" },
  { id: "R2", codigo: "MEC-B", nome: "Montador B", centroId: "C1", centroNome: "Montagem" },
  { id: "R3", codigo: "PINT", nome: "Pintura", centroId: "C2", centroNome: "Pintura" },
];

const barra = (op: string, ordem: string, recursoId: string, ini: string, fim: string, extra: Partial<BarraLayout> = {}): BarraLayout => ({
  operacaoId: op,
  ordemId: ordem,
  ordemCodigo: ordem,
  recursoId,
  inicio: t("2026-10-26", ini),
  fim: t("2026-10-26", fim),
  produto: "Quadro 24",
  cliente: "Hospital",
  prazo: "2026-10-30",
  atrasoMin: 0,
  fixada: false,
  emExecucao: false,
  ...extra,
});

const barras = [
  barra("a1", "4301", "R1", "08:00", "10:00"),
  barra("a2", "4301", "R2", "08:00", "11:00"), // paralela à a1
  barra("a3", "4301", "R3", "11:00", "12:00"),
  barra("b1", "4302", "R1", "10:00", "12:00", { cliente: "Solar Vale", atrasoMin: 120 }),
  barra("c1", "4303", "R3", "13:00", "14:00", { cliente: null, fixada: true }),
];

describe("layout do Gantt", () => {
  it("por recurso: grupos por centro e uma faixa por recurso", () => {
    const l = montarLayout({ visao: "recurso", filtros: FILTROS_VAZIOS, barras, recursos, fuso: FUSO });
    assert.deepEqual(l.grupos.map((g) => g.titulo), ["Montagem", "Pintura"]);
    assert.deepEqual(l.faixas.map((f) => f.id), ["R1", "R2", "R3"]);
    assert.equal(l.topoDaBarra.get("a1"), ALTURA_GRUPO + MARGEM_BARRA);
    assert.equal(l.altura, 2 * ALTURA_GRUPO + 3 * ALTURA_FAIXA);
    assert.equal(l.totalOrdens, 3);
    assert.equal(l.filtroAtivo, false);
  });

  it("por OP: uma faixa por OP e operações paralelas empilhadas", () => {
    const l = montarLayout({ visao: "op", filtros: FILTROS_VAZIOS, barras, recursos, fuso: FUSO });
    assert.deepEqual(l.faixas.map((f) => f.id), ["4301", "4302", "4303"]); // ordem de início
    const op = l.faixas[0];
    assert.equal(op.altura, ALTURA_FAIXA + ALTURA_SUBLINHA); // duas operações ao mesmo tempo
    assert.equal(l.topoDaBarra.get("a1"), MARGEM_BARRA);
    assert.equal(l.topoDaBarra.get("a2"), MARGEM_BARRA + ALTURA_SUBLINHA);
    assert.equal(l.topoDaBarra.get("a3"), MARGEM_BARRA); // depois de a1, volta para a primeira sublinha
    assert.equal(op.tipo === "op" && op.subtitulo, "Quadro 24 · entrega 30/10");
  });

  it("por cliente: grupos por cliente, 'Sem cliente' por último", () => {
    const l = montarLayout({ visao: "cliente", filtros: FILTROS_VAZIOS, barras, recursos, fuso: FUSO });
    assert.deepEqual(l.grupos.map((g) => g.titulo), ["Hospital · 1 OP", "Solar Vale · 1 OP", "Sem cliente · 1 OP"]);
  });

  it("filtros por texto, cliente e situação valem para a OP inteira", () => {
    const porTexto = montarLayout({ visao: "op", filtros: { ...FILTROS_VAZIOS, texto: "solar" }, barras, recursos, fuso: FUSO });
    assert.deepEqual(porTexto.faixas.map((f) => f.id), ["4302"]);
    const semCliente = montarLayout({ visao: "op", filtros: { ...FILTROS_VAZIOS, cliente: SEM_CLIENTE }, barras, recursos, fuso: FUSO });
    assert.deepEqual(semCliente.faixas.map((f) => f.id), ["4303"]);
    const atrasadas = montarLayout({ visao: "op", filtros: { ...FILTROS_VAZIOS, situacao: "atrasadas" }, barras, recursos, fuso: FUSO });
    assert.deepEqual(atrasadas.faixas.map((f) => f.id), ["4302"]);
    const fixadas = montarLayout({ visao: "op", filtros: { ...FILTROS_VAZIOS, situacao: "fixadas" }, barras, recursos, fuso: FUSO });
    assert.deepEqual(fixadas.faixas.map((f) => f.id), ["4303"]);
    assert.equal(fixadas.ordensVisiveis, 1);
    assert.equal(fixadas.filtroAtivo, true);
  });

  it("por recurso com filtro de OP esconde recursos sem barra", () => {
    const l = montarLayout({ visao: "recurso", filtros: { ...FILTROS_VAZIOS, texto: "4302" }, barras, recursos, fuso: FUSO });
    assert.deepEqual(l.faixas.map((f) => f.id), ["R1"]);
    assert.equal(l.topoDaBarra.has("a1"), false);
  });

  it("filtro de centro mostra o centro inteiro e só as operações dele", () => {
    const l = montarLayout({ visao: "recurso", filtros: { ...FILTROS_VAZIOS, centroId: "C1" }, barras, recursos, fuso: FUSO });
    assert.deepEqual(l.faixas.map((f) => f.id), ["R1", "R2"]);
    const op = montarLayout({ visao: "op", filtros: { ...FILTROS_VAZIOS, centroId: "C2" }, barras, recursos, fuso: FUSO });
    assert.deepEqual(op.faixas.map((f) => f.id), ["4301", "4303"]);
    assert.equal(op.topoDaBarra.has("a1"), false);
    assert.equal(op.topoDaBarra.has("a3"), true);
  });

  it("acentos e maiúsculas não atrapalham a busca", () => {
    const l = montarLayout({
      visao: "op",
      filtros: { ...FILTROS_VAZIOS, texto: "condominio" },
      barras: [barra("x", "9", "R1", "08:00", "09:00", { cliente: "Condomínio Parque" })],
      recursos,
      fuso: FUSO,
    });
    assert.equal(l.faixas.length, 1);
  });
});
