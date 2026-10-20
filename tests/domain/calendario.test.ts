import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encontrarEncaixe, gerarDisponibilidade, minutosDisponiveis, subtrair } from "../../src/domain/calendario.ts";
import { DIA, HORA } from "../../src/domain/tempo.ts";
import { AGORA, FUSO, t, turnoComercial } from "./ajuda.ts";

describe("calendário", () => {
  it("gera os turnos de segunda a sexta e pula o fim de semana", () => {
    const disp = gerarDisponibilidade({ periodos: turnoComercial, feriados: [], indisponibilidades: [], de: AGORA, ate: AGORA + 7 * DIA, fuso: FUSO });
    assert.equal(disp.length, 10); // 5 dias × 2 períodos
    assert.equal(disp[0].inicio, t("2026-10-26", "08:00"));
    assert.equal(disp[1].fim, t("2026-10-26", "17:00"));
    assert.equal(minutosDisponiveis(disp, AGORA, AGORA + 7 * DIA), 5 * 8 * 60);
    assert.ok(disp.every((i) => i.inicio < t("2026-10-31", "00:00") || i.inicio >= t("2026-11-02", "00:00")));
  });

  it("remove feriados e indisponibilidades", () => {
    const manutencao = { inicio: t("2026-10-27", "09:00"), fim: t("2026-10-27", "11:00") };
    const disp = gerarDisponibilidade({
      periodos: turnoComercial,
      feriados: ["2026-10-28"],
      indisponibilidades: [manutencao],
      de: AGORA,
      ate: t("2026-10-29", "23:59"),
      fuso: FUSO,
    });
    assert.equal(minutosDisponiveis(disp, AGORA, t("2026-10-30", "00:00")), 8 * 60 * 3 - 120);
    assert.ok(!disp.some((i) => i.inicio < manutencao.fim && i.fim > manutencao.inicio));
    assert.ok(!disp.some((i) => i.inicio >= t("2026-10-28", "00:00") && i.inicio < t("2026-10-29", "00:00")));
  });

  it("aceita turno noturno que passa da meia-noite", () => {
    const noturno = [{ diaSemana: 1, inicioMin: 22 * 60, fimMin: 30 * 60 }]; // segunda 22:00 → terça 06:00
    const disp = gerarDisponibilidade({ periodos: noturno, feriados: [], indisponibilidades: [], de: AGORA, ate: AGORA + 3 * DIA, fuso: FUSO });
    assert.deepEqual(disp, [{ inicio: t("2026-10-26", "22:00"), fim: t("2026-10-27", "06:00") }]);
  });

  it("subtrai intervalos corretamente", () => {
    assert.deepEqual(subtrair([{ inicio: 0, fim: 10 }], [{ inicio: 2, fim: 4 }, { inicio: 8, fim: 12 }]), [
      { inicio: 0, fim: 2 },
      { inicio: 4, fim: 8 },
    ]);
  });
});

describe("encaixe de operação", () => {
  const disp = gerarDisponibilidade({ periodos: turnoComercial, feriados: [], indisponibilidades: [], de: AGORA, ate: AGORA + 14 * DIA, fuso: FUSO });

  it("começa no início do turno e atravessa o almoço e a noite", () => {
    const r = encontrarEncaixe(disp, [], AGORA, 10 * 60); // 10 h de trabalho
    assert.ok(r.ok);
    assert.equal(r.encaixe.inicio, t("2026-10-26", "08:00"));
    assert.equal(r.encaixe.fim, t("2026-10-27", "10:00"));
    assert.equal(r.encaixe.segmentos.length, 3);
  });

  it("não divide a operação em volta de outra: vai para depois se não couber no espaço", () => {
    const ocupada = [{ inicio: t("2026-10-26", "10:00"), fim: t("2026-10-26", "15:00"), operacaoId: "x" }];
    const curta = encontrarEncaixe(disp, ocupada, AGORA, 90);
    assert.ok(curta.ok);
    assert.equal(curta.encaixe.inicio, t("2026-10-26", "08:00")); // cabe inteira antes
    const longa = encontrarEncaixe(disp, ocupada, AGORA, 3 * 60);
    assert.ok(longa.ok);
    assert.equal(longa.encaixe.inicio, t("2026-10-26", "15:00")); // não cabe antes → depois
    assert.equal(longa.bloqueadoPor?.operacaoId, "x");
  });

  it("informa quando não há turno ou não cabe no horizonte", () => {
    assert.deepEqual(encontrarEncaixe([], [], AGORA, 60), { ok: false, motivo: "sem_turno" });
    const r = encontrarEncaixe(disp, [], AGORA, 1000 * HORA);
    assert.equal(r.ok, false);
  });
});
