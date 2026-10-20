import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aplicarArraste, desafixar } from "../../src/domain/aps/arraste.ts";
import { compararProgramacoes } from "../../src/domain/aps/comparacao.ts";
import { sequenciar } from "../../src/domain/aps/sequenciador.ts";
import type { OrdemEntrada } from "../../src/domain/aps/tipos.ts";
import { fimDoDia } from "../../src/domain/tempo.ts";
import { AGORA, FUSO, entrada, op, ordem, recurso, t } from "./ajuda.ts";

const recursos = () => [recurso("M1"), recurso("M2"), recurso("P1")];
const ordens = (): OrdemEntrada[] => [
  ordem("A", [op("Montagem", 240, ["M1", "M2"]), op("Pintura", 120, ["P1"])], { prazoEntrega: fimDoDia("2026-10-28", FUSO) }),
  ordem("B", [op("Montagem", 240, ["M1"]), op("Pintura", 120, ["P1"])], { prazoEntrega: fimDoDia("2026-10-29", FUSO) }),
  ordem("C", [op("Montagem", 240, ["M1"]), op("Pintura", 120, ["P1"])], { prazoEntrega: fimDoDia("2026-10-30", FUSO) }),
];

function contexto(base: ReturnType<typeof sequenciar>, codigo: string, lista = ordens()) {
  return {
    agora: AGORA,
    fuso: FUSO,
    ordem: lista.find((o) => o.codigo === codigo)!,
    itensBase: base.itens,
    fixacoesAtuais: base.fixacoesAplicadas,
    nomeRecurso: (id: string) => id,
  };
}

describe("arraste no Gantt", () => {
  const base = sequenciar(entrada(recursos(), ordens()));

  it("OP inteira: a primeira operação vai para a data solta e as seguintes acompanham", () => {
    const novoInicio = t("2026-10-30", "08:00");
    const r = aplicarArraste({ modo: "ordem", operacaoId: "B:Pintura", novoInicio: novoInicio + 0 }, contexto(base, "B"));
    assert.ok(r.ok);
    // Arrastou a Pintura, mas a OP inteira desloca: a fixação vai na Montagem, pelo mesmo deslocamento.
    const montagemBase = base.itens.find((i) => i.operacaoId === "B:Montagem")!;
    const pinturaBase = base.itens.find((i) => i.operacaoId === "B:Pintura")!;
    assert.deepEqual(r.fixacoes, [
      { operacaoId: "B:Montagem", inicio: montagemBase.inicio + (novoInicio - pinturaBase.inicio), recursoId: montagemBase.recursoId },
    ]);
    const nova = sequenciar(entrada(recursos(), ordens(), r.fixacoes));
    const pintura = nova.itens.find((i) => i.operacaoId === "B:Pintura")!;
    const montagem = nova.itens.find((i) => i.operacaoId === "B:Montagem")!;
    assert.ok(pintura.inicio >= montagem.fim);
  });

  it("só a operação: bloqueia antes do fim da operação anterior e explica", () => {
    const montagem = base.itens.find((i) => i.operacaoId === "A:Montagem")!;
    const r = aplicarArraste({ modo: "operacao", operacaoId: "A:Pintura", novoInicio: montagem.fim - 60 * 60_000 }, contexto(base, "A"));
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.erro, /depende de "Montagem", que termina em/);
  });

  it("só a operação: aceita a partir do fim da anterior e fixa no recurso da linha", () => {
    const montagem = base.itens.find((i) => i.operacaoId === "A:Montagem")!;
    const r = aplicarArraste({ modo: "operacao", operacaoId: "A:Pintura", novoInicio: montagem.fim + 120 * 60_000 }, contexto(base, "A"));
    assert.ok(r.ok);
    assert.equal(r.fixacoes[0].recursoId, "P1");
  });

  it("troca de recurso: aceita elegível, recusa incompatível", () => {
    const ok = aplicarArraste({ modo: "operacao", operacaoId: "A:Montagem", novoInicio: t("2026-10-27", "08:00"), recursoId: "M2" }, contexto(base, "A"));
    assert.ok(ok.ok);
    const nao = aplicarArraste({ modo: "operacao", operacaoId: "A:Montagem", novoInicio: t("2026-10-27", "08:00"), recursoId: "P1" }, contexto(base, "A"));
    assert.equal(nao.ok, false);
    assert.match(nao.ok ? "" : nao.erro, /não está habilitado/);
  });

  it("não move operação já iniciada nem para antes de agora", () => {
    const lista = ordens();
    lista[0].operacoes[0].status = "em_execucao";
    const iniciada = aplicarArraste({ modo: "operacao", operacaoId: "A:Montagem", novoInicio: t("2026-10-28", "08:00") }, contexto(base, "A", lista));
    assert.equal(iniciada.ok, false);
    const passado = aplicarArraste({ modo: "ordem", operacaoId: "B:Montagem", novoInicio: AGORA - 3_600_000 }, contexto(base, "B"));
    assert.equal(passado.ok, false);
  });

  it("OP inteira substitui as fixações antigas da OP; desafixar remove", () => {
    const primeira = aplicarArraste({ modo: "operacao", operacaoId: "C:Pintura", novoInicio: t("2026-11-03", "08:00") }, contexto(base, "C"));
    assert.ok(primeira.ok);
    const ctx = { ...contexto(base, "C"), fixacoesAtuais: primeira.fixacoes };
    const segunda = aplicarArraste({ modo: "ordem", operacaoId: "C:Montagem", novoInicio: t("2026-11-02", "08:00") }, ctx);
    assert.ok(segunda.ok);
    assert.deepEqual(segunda.fixacoes.map((f) => f.operacaoId), ["C:Montagem"]);
    assert.deepEqual(desafixar(segunda.fixacoes, ["C:Montagem"]), []);
  });

  it("antes × depois: mostra quem adiantou e quem passou a atrasar", () => {
    const r = aplicarArraste({ modo: "ordem", operacaoId: "A:Montagem", novoInicio: t("2026-11-02", "08:00") }, contexto(base, "A"));
    assert.ok(r.ok);
    const depois = sequenciar(entrada(recursos(), ordens(), r.fixacoes));
    const mudancas = compararProgramacoes(base.ordens, depois.ordens);
    const a = mudancas.find((m) => m.ordemId === "A")!;
    assert.equal(a.situacao, "passou_a_atrasar");
    assert.ok(mudancas.some((m) => m.situacao === "adiantou"));
    assert.equal(mudancas[0].ordemId, "A"); // o mais grave aparece primeiro
  });
});
