import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tempoTrabalhado, trechosDeParada, validarEvento, type ContextoEvento } from "../../src/domain/mes/execucao.ts";
import { duracaoProcessamento, statusPelasOperacoes, validarAcaoOrdem } from "../../src/domain/ordens/status.ts";

const base: ContextoEvento = {
  statusAtual: "pendente",
  tipo: "inicio",
  anterioresPendentes: [],
  ocupacaoRecurso: null,
  quantidadePlanejada: 2,
  produzidoAntes: 0,
};

describe("apontamento (MES)", () => {
  it("segue as transições válidas", () => {
    assert.deepEqual(validarEvento(base), { ok: true, novoStatus: "em_execucao" });
    assert.deepEqual(validarEvento({ ...base, statusAtual: "em_execucao", tipo: "pausa", motivoParadaId: "m" }), { ok: true, novoStatus: "pausada" });
    assert.deepEqual(validarEvento({ ...base, statusAtual: "pausada", tipo: "retomada" }), { ok: true, novoStatus: "em_execucao" });
    assert.deepEqual(validarEvento({ ...base, statusAtual: "em_execucao", tipo: "fim", quantidades: { boa: 2, rejeitada: 0 } }), {
      ok: true,
      novoStatus: "concluida",
    });
  });

  it("recusa transições impossíveis com mensagem clara", () => {
    const r = validarEvento({ ...base, statusAtual: "concluida", tipo: "inicio" });
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.erro, /já foi concluída/);
    assert.equal(validarEvento({ ...base, statusAtual: "pausada", tipo: "fim", quantidades: { boa: 1, rejeitada: 0 } }).ok, false);
  });

  it("exige motivo na pausa e operações anteriores concluídas no início", () => {
    assert.equal(validarEvento({ ...base, statusAtual: "em_execucao", tipo: "pausa" }).ok, false);
    const r = validarEvento({ ...base, anterioresPendentes: ["Montagem mecânica"] });
    assert.match(r.ok ? "" : r.erro, /Montagem mecânica/);
  });

  it("não deixa duas operações ao mesmo tempo no mesmo recurso", () => {
    const r = validarEvento({ ...base, ocupacaoRecurso: "OP 4342 · Fiação" });
    assert.match(r.ok ? "" : r.erro, /já está produzindo OP 4342/);
  });

  it("valida quantidades e pede confirmação de excedente", () => {
    const fim = { ...base, statusAtual: "em_execucao" as const, tipo: "fim" as const };
    assert.equal(validarEvento({ ...fim, quantidades: { boa: 0, rejeitada: 0 } }).ok, false);
    assert.equal(validarEvento({ ...fim, quantidades: { boa: -1, rejeitada: 0 } }).ok, false);
    assert.equal(validarEvento({ ...fim, quantidades: { boa: 3, rejeitada: 0 } }).ok, false);
    assert.equal(validarEvento({ ...fim, quantidades: { boa: 3, rejeitada: 0 }, confirmarExcedente: true }).ok, true);
  });

  it("calcula tempo trabalhado e trechos de parada a partir dos eventos", () => {
    const min = 60_000;
    const eventos = [
      { tipo: "inicio" as const, ocorridoEm: 0, motivoParadaId: null },
      { tipo: "pausa" as const, ocorridoEm: 30 * min, motivoParadaId: "falta-material" },
      { tipo: "retomada" as const, ocorridoEm: 50 * min, motivoParadaId: null },
    ];
    assert.equal(tempoTrabalhado(eventos, 60 * min), 40 * min);
    assert.deepEqual(trechosDeParada(eventos, 60 * min), [{ motivoParadaId: "falta-material", inicio: 30 * min, fim: 50 * min }]);
    // Parada ainda aberta conta até agora.
    assert.equal(trechosDeParada(eventos.slice(0, 2), 45 * min)[0].fim, 45 * min);
  });
});

describe("ordem de produção", () => {
  it("valida as ações manuais de status", () => {
    assert.deepEqual(validarAcaoOrdem("rascunho", "liberar", { operacoesDoRoteiro: 3 }), { ok: true, novoStatus: "liberada" });
    assert.equal(validarAcaoOrdem("rascunho", "liberar", { operacoesDoRoteiro: 0 }).ok, false);
    assert.equal(validarAcaoOrdem("em_execucao", "cancelar").ok, false);
    assert.equal(validarAcaoOrdem("liberada", "cancelar", { algumaIniciada: true }).ok, false);
  });

  it("deriva o status pelas operações", () => {
    assert.equal(statusPelasOperacoes("liberada", ["pendente", "pendente"]), "liberada");
    assert.equal(statusPelasOperacoes("liberada", ["concluida", "pendente"]), "em_execucao");
    assert.equal(statusPelasOperacoes("em_execucao", ["concluida", "concluida", "cancelada"]), "concluida");
  });

  it("calcula a duração do processamento pela quantidade", () => {
    assert.equal(duracaoProcessamento(30, 60, 2), 120);
    assert.equal(duracaoProcessamento(0.5, 0, 3), 2); // arredonda para cima
  });
});
