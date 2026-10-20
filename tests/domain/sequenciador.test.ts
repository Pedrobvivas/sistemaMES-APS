import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sequenciar } from "../../src/domain/aps/sequenciador.ts";
import type { ResultadoSequenciamento } from "../../src/domain/aps/tipos.ts";
import { fimDoDia } from "../../src/domain/tempo.ts";
import { FUSO, entrada, op, ordem, recurso, t } from "./ajuda.ts";

const item = (r: ResultadoSequenciamento, operacaoId: string) => {
  const i = r.itens.find((x) => x.operacaoId === operacaoId);
  assert.ok(i, `operação ${operacaoId} deveria estar programada`);
  return i;
};

describe("sequenciador — restrições básicas", () => {
  it("recurso limitado: uma ordem depois da outra, sem sobreposição", () => {
    const r = sequenciar(
      entrada([recurso("M1")], [ordem("A", [op("Montagem", 240, ["M1"])]), ordem("B", [op("Montagem", 240, ["M1"])])]),
    );
    const a = item(r, "A:Montagem");
    const b = item(r, "B:Montagem");
    assert.equal(a.inicio, t("2026-10-26", "08:00"));
    assert.equal(a.fim, t("2026-10-26", "12:00"));
    assert.equal(b.inicio, t("2026-10-26", "13:00"));
    assert.ok(b.inicio >= a.fim);
  });

  it("fila: prioridade alta antes; empate decide pela data de entrega", () => {
    const r = sequenciar(
      entrada(
        [recurso("M1")],
        [
          ordem("N-LONGE", [op("Montagem", 60, ["M1"])], { prioridade: 2, prazoEntrega: fimDoDia("2026-11-20", FUSO) }),
          ordem("N-PERTO", [op("Montagem", 60, ["M1"])], { prioridade: 2, prazoEntrega: fimDoDia("2026-11-05", FUSO) }),
          ordem("URGENTE", [op("Montagem", 60, ["M1"])], { prioridade: 1, prazoEntrega: fimDoDia("2026-11-25", FUSO) }),
        ],
      ),
    );
    const ordemDeInicio = [...r.itens].sort((x, y) => x.inicio - y.inicio).map((i) => i.ordemId);
    assert.deepEqual(ordemDeInicio, ["URGENTE", "N-PERTO", "N-LONGE"]);
    assert.deepEqual(r.ordens.map((o) => o.ordemId), ["URGENTE", "N-PERTO", "N-LONGE"]);
  });

  it("dependência: a operação seguinte só começa depois da anterior, mesmo em outro recurso", () => {
    const r = sequenciar(entrada([recurso("M1"), recurso("P1")], [ordem("A", [op("Montagem", 300, ["M1"]), op("Pintura", 60, ["P1"])])]));
    const m = item(r, "A:Montagem");
    const p = item(r, "A:Pintura");
    assert.equal(m.fim, t("2026-10-26", "14:00"));
    assert.equal(p.inicio, m.fim);
    assert.match(p.justificativa, /término de "Montagem"/);
  });

  it("operações com a mesma sequência podem correr em paralelo", () => {
    const r = sequenciar(
      entrada(
        [recurso("M1"), recurso("E1"), recurso("T1")],
        [
          ordem("A", [
            op("Mecânica", 120, ["M1"], { sequencia: 10 }),
            op("Elétrica", 180, ["E1"], { sequencia: 10 }),
            op("Teste", 60, ["T1"], { sequencia: 20 }),
          ]),
        ],
      ),
    );
    assert.equal(item(r, "A:Mecânica").inicio, item(r, "A:Elétrica").inicio);
    assert.equal(item(r, "A:Teste").inicio, item(r, "A:Elétrica").fim); // espera a mais longa
  });

  it("indisponibilidade: a operação desvia da manutenção", () => {
    const manut = { inicio: t("2026-10-26", "08:00"), fim: t("2026-10-26", "12:00") };
    const r = sequenciar(entrada([recurso("M1", { indisponibilidades: [manut] })], [ordem("A", [op("Montagem", 60, ["M1"])])]));
    assert.equal(item(r, "A:Montagem").inicio, t("2026-10-26", "13:00"));
  });

  it("recursos alternativos: usa o elegível que termina mais cedo", () => {
    const r = sequenciar(
      entrada(
        [recurso("M1"), recurso("M2")],
        [ordem("A", [op("Montagem", 240, ["M1", "M2"])]), ordem("B", [op("Montagem", 240, ["M1", "M2"])])],
      ),
    );
    assert.equal(item(r, "A:Montagem").recursoId, "M1"); // empate → preferência
    assert.equal(item(r, "B:Montagem").recursoId, "M2");
    assert.equal(item(r, "B:Montagem").inicio, t("2026-10-26", "08:00"));
    assert.match(item(r, "B:Montagem").justificativa, /2 elegíveis/);
  });

  it("prazo conflitante: calcula atraso e conta nas métricas", () => {
    const r = sequenciar(
      entrada([recurso("M1")], [ordem("A", [op("Montagem", 16 * 60, ["M1"])], { prazoEntrega: fimDoDia("2026-10-26", FUSO) })]),
    );
    const resumo = r.ordens[0];
    assert.equal(resumo.fimPrevisto, t("2026-10-27", "17:00"));
    assert.equal(resumo.atrasoMin, Math.ceil((t("2026-10-27", "17:00") - fimDoDia("2026-10-26", FUSO)) / 60000));
    assert.equal(r.metricas.ordensAtrasadas, 1);
    assert.equal(r.metricas.atrasoTotalMin, resumo.atrasoMin);
  });

  it("conflitos explicados: sem recurso elegível bloqueia as seguintes", () => {
    const r = sequenciar(entrada([recurso("M1")], [ordem("A", [op("Corte", 60, ["NAO-EXISTE"]), op("Montagem", 60, ["M1"])])]));
    assert.equal(r.itens.length, 0);
    assert.deepEqual(
      r.conflitos.map((c) => c.tipo),
      ["sem_recurso_elegivel", "predecessora_nao_programada"],
    );
    assert.equal(r.ordens[0].completa, false);
    assert.equal(r.metricas.operacoesNaoProgramadas, 2);
  });

  it("fora do horizonte vira conflito em vez de programação inventada", () => {
    const r = sequenciar(entrada([recurso("M1")], [ordem("A", [op("Montagem", 400 * 60, ["M1"])])]));
    assert.equal(r.conflitos[0].tipo, "fora_horizonte");
  });

  it("operação em execução fica no recurso dela a partir de agora, à frente da fila", () => {
    const r = sequenciar(
      entrada(
        [recurso("M1"), recurso("M2")],
        [
          ordem("URG", [op("Montagem", 60, ["M1"])], { prioridade: 1 }),
          ordem("EXE", [op("Montagem", 120, ["M1", "M2"], { status: "em_execucao", recursoAtualId: "M1", minutosRestantes: 30 })], { prioridade: 3 }),
        ],
      ),
    );
    const exe = item(r, "EXE:Montagem");
    assert.equal(exe.recursoId, "M1");
    assert.equal(exe.emExecucao, true);
    assert.equal(exe.fim, t("2026-10-26", "08:30"));
    assert.equal(item(r, "URG:Montagem").inicio, t("2026-10-26", "08:30"));
  });

  it("é determinístico: mesma entrada, mesma saída, independentemente da ordem da lista", () => {
    const ordens = [
      ordem("A", [op("Montagem", 200, ["M1", "M2"]), op("Teste", 30, ["T1"])]),
      ordem("B", [op("Montagem", 100, ["M1", "M2"]), op("Teste", 30, ["T1"])], { prioridade: 1 }),
      ordem("C", [op("Montagem", 300, ["M2"])]),
    ];
    const recursos = [recurso("M1"), recurso("M2"), recurso("T1")];
    const r1 = sequenciar(entrada(recursos, ordens));
    const r2 = sequenciar(entrada([...recursos].reverse(), [...ordens].reverse()));
    assert.deepEqual(r1.itens, r2.itens);
  });
});

describe("sequenciador — data fixada pelo arraste", () => {
  // Fila A → B → C → D no mesmo recurso, 4 h cada (meio dia).
  const fila = () =>
    ["A", "B", "C", "D"].map((c, i) =>
      ordem(c, [op("Montagem", 240, ["M1"])], { prazoEntrega: fimDoDia(`2026-11-0${i + 2}`, FUSO) }),
    );

  it("sem fixação: segue a fila", () => {
    const r = sequenciar(entrada([recurso("M1")], fila()));
    assert.deepEqual(
      [...r.itens].sort((x, y) => x.inicio - y.inicio).map((i) => i.ordemId),
      ["A", "B", "C", "D"],
    );
  });

  it("B arrastada para sexta: começa na data e as outras são adiantadas na mesma ordem", () => {
    const antes = sequenciar(entrada([recurso("M1")], fila()));
    const sexta = t("2026-10-30", "08:00");
    const r = sequenciar(entrada([recurso("M1")], fila(), [{ operacaoId: "B:Montagem", inicio: sexta, recursoId: "M1" }]));
    const b = item(r, "B:Montagem");
    assert.equal(b.inicio, sexta);
    assert.equal(b.fixada, true);
    // C e D ocupam o espaço que B deixou, mantendo a ordem da fila.
    assert.equal(item(r, "C:Montagem").inicio, item(antes, "B:Montagem").inicio);
    assert.equal(item(r, "D:Montagem").inicio, item(antes, "C:Montagem").inicio);
    assert.ok(item(r, "C:Montagem").inicio < item(r, "D:Montagem").inicio);
    assert.equal(r.conflitos.length, 0);
  });

  it("choque: B tem a data garantida; C só fica antes se couber inteira, senão vai para depois de B", () => {
    // B fixada segunda 10:00. A (4 h) começaria 08:00 e invadiria B → A não cabe antes.
    const r = sequenciar(entrada([recurso("M1")], fila(), [{ operacaoId: "B:Montagem", inicio: t("2026-10-26", "10:00") }]));
    const b = item(r, "B:Montagem");
    assert.equal(b.inicio, t("2026-10-26", "10:00"));
    const a = item(r, "A:Montagem");
    assert.ok(a.inicio >= b.fim, "A não cabe nas 2 h antes de B e deve ir para depois");
    assert.match(a.justificativa, /Recurso ocupado por OP B/);
    // Uma OP curta da fila aproveita o espaço antes de B.
    const comCurta = sequenciar(
      entrada([recurso("M1")], [...fila(), ordem("E", [op("Ajuste", 90, ["M1"])], { prioridade: 3 })], [
        { operacaoId: "B:Montagem", inicio: t("2026-10-26", "10:00") },
      ]),
    );
    assert.equal(item(comCurta, "E:Ajuste").inicio, t("2026-10-26", "08:00"));
  });

  it("data solta fora do turno: começa no próximo horário de trabalho", () => {
    const r = sequenciar(entrada([recurso("M1")], fila(), [{ operacaoId: "C:Montagem", inicio: t("2026-10-31", "10:00") }])); // sábado
    assert.equal(item(r, "C:Montagem").inicio, t("2026-11-02", "08:00"));
    assert.match(item(r, "C:Montagem").justificativa, /fora do turno/);
  });

  it("duas fixações no mesmo horário: a segunda é informada como não cumprida", () => {
    const sexta = t("2026-10-30", "08:00");
    const r = sequenciar(
      entrada([recurso("M1")], fila(), [
        { operacaoId: "C:Montagem", inicio: sexta },
        { operacaoId: "D:Montagem", inicio: sexta },
      ]),
    );
    assert.equal(item(r, "C:Montagem").inicio, sexta); // C vem antes na fila
    assert.equal(item(r, "D:Montagem").inicio, t("2026-10-30", "13:00")); // depois de C (e do almoço)
    assert.equal(r.conflitos.filter((c) => c.tipo === "fixacao_nao_cumprida").length, 1);
  });

  it("fixação que violaria a dependência vira 'não antes de' e é explicada", () => {
    // A Pintura foi fixada cedo, mas a Montagem da mesma OP ficou atrás de outra OP urgente.
    const ordens = [
      ordem("URG", [op("Montagem", 480, ["M1"])], { prioridade: 1 }),
      ordem("X", [op("Montagem", 120, ["M1"]), op("Pintura", 60, ["P1"])]),
    ];
    const r = sequenciar(entrada([recurso("M1"), recurso("P1")], ordens, [{ operacaoId: "X:Pintura", inicio: t("2026-10-26", "09:00") }]));
    const m = item(r, "X:Montagem");
    const p = item(r, "X:Pintura");
    assert.ok(p.inicio >= m.fim);
    assert.equal(p.fixada, true);
    const c = r.conflitos.find((x) => x.tipo === "fixacao_nao_cumprida");
    assert.ok(c);
    assert.match(c.mensagem, /depende de "Montagem"/);
  });

  it("troca de recurso pelo arraste vale quando o recurso é elegível", () => {
    const r = sequenciar(
      entrada([recurso("M1"), recurso("M2")], [ordem("A", [op("Montagem", 60, ["M1", "M2"])])], [
        { operacaoId: "A:Montagem", inicio: t("2026-10-27", "08:00"), recursoId: "M2" },
      ]),
    );
    assert.equal(item(r, "A:Montagem").recursoId, "M2");
  });

  it("fixação em operação já iniciada é ignorada com aviso", () => {
    const r = sequenciar(
      entrada(
        [recurso("M1")],
        [ordem("A", [op("Montagem", 60, ["M1"], { status: "em_execucao", recursoAtualId: "M1", minutosRestantes: 20 })])],
        [{ operacaoId: "A:Montagem", inicio: t("2026-10-29", "08:00") }],
      ),
    );
    assert.equal(r.conflitos[0].tipo, "fixacao_ignorada");
    assert.equal(item(r, "A:Montagem").fim, t("2026-10-26", "08:20"));
  });
});
