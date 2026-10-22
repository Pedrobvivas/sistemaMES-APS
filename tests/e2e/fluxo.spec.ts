// Fluxo completo do protótipo no navegador, com o build de produção e banco real:
// configuração → demonstração → Gantt com arraste → aprovação → terminal → perfis.
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { nome: "Admin Teste", email: "admin@teste.local", senha: "senha-forte-123" };
const OPERADOR = { nome: "Operador Teste", email: "operador@teste.local", senha: "senha-forte-456" };

test.describe.configure({ mode: "serial" });

// Uma única sessão do navegador para todos os passos: o Better Auth limita
// tentativas de login seguidas, e o fluxo real é de um usuário só.
let page: Page;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({
    baseURL: "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 900 },
  });
  page.on("dialog", (d) => d.accept());
});
test.afterAll(async () => {
  await page.close();
});

async function entrar(page: Page, email: string, senha: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

// Abre uma tela e confere que não houve redirecionamento nem erro.
async function abrir(page: Page, caminho: string) {
  await page.goto(caminho);
  await expect(page).toHaveURL(new RegExp(caminho.replace(/[?]/g, "\\?")));
  await expect(page.getByText("Não conseguimos carregar esta página")).toHaveCount(0);
}

// Arrasta uma barra do Gantt horizontalmente (e opcionalmente na vertical).
async function arrastar(page: Page, barra: ReturnType<Page["locator"]>, dx: number, dy = 0) {
  await barra.scrollIntoViewIfNeeded();
  const caixa = await barra.boundingBox();
  if (!caixa) throw new Error("barra sem posição");
  const x = caixa.x + Math.min(20, caixa.width / 2);
  const y = caixa.y + caixa.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
  await page.mouse.up();
}

test("configuração inicial e carga da demonstração", async () => {
  await page.goto("/configurar");
  await page.getByLabel("Seu nome").fill(ADMIN.nome);
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.senha);
  await page.getByRole("button").filter({ hasText: /criar|configurar|começar/i }).first().click();
  await expect(page).toHaveURL(/\/entrar/);

  await entrar(page, ADMIN.email, ADMIN.senha);
  await expect(page).toHaveURL(/\/visao-geral/);

  await abrir(page, "/sistema");
  await page.getByRole("button", { name: "Carregar demonstração" }).click();
  await expect(page.getByText("Dados de demonstração carregados e programação aprovada")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Demonstração · dados fictícios")).toBeVisible();
});

test("Gantt: arrastar a OP gera versão sugerida com antes × depois e data fixada", async () => {
  await abrir(page, "/programacao");
  await expect(page.getByText("Aprovada · em vigor")).toBeVisible();
  await page.screenshot({ path: "test-results/01-gantt-aprovado.png", fullPage: true });

  const barra = page.locator('button[aria-label^="OP 4310 · Corte ·"]');
  await expect(barra).toBeVisible();
  await expect(barra).not.toHaveAttribute("aria-label", /Data fixada/);

  await arrastar(page, barra, 330); // ~30 h à direita na escala Semana
  await expect(page).toHaveURL(/versao=/, { timeout: 30_000 });
  await expect(page.getByText("Sugerida · aguardando aprovação")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Antes × depois/ })).toBeVisible();
  await expect(page.locator('button[aria-label^="OP 4310 · Corte ·"]')).toHaveAttribute("aria-label", /Data fixada/);
  await expect(page.getByText(/OP 4310 movida para começar em/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/02-gantt-sugerido.png", fullPage: true });
});

test("Gantt: só a operação, antes da anterior, é recusado com explicação", async () => {
  await abrir(page, "/programacao");
  await page.getByText("Só a operação", { exact: true }).click();
  const corte = page.locator('button[aria-label^="OP 4310 · Corte ·"]');
  const dobra = page.locator('button[aria-label^="OP 4310 · Dobra ·"]');
  await dobra.scrollIntoViewIfNeeded();
  const [cx, dx] = [await corte.boundingBox(), await dobra.boundingBox()];
  if (!cx || !dx) throw new Error("barras sem posição");
  // Solta a Dobra logo depois do início do Corte (antes de ele terminar).
  await arrastar(page, dobra, cx.x + 4 - dx.x);
  await expect(page.getByRole("alert").filter({ hasText: /Depende de "Corte"/ })).toBeVisible();
  await expect(page.getByText("Sugerida · aguardando aprovação")).toBeVisible(); // nada mudou
});

test("Gantt: ver por OP e por cliente, com filtros, e arrastar na visão por OP", async () => {
  await abrir(page, "/programacao");
  const verPor = (nome: string) => page.getByRole("group", { name: "Ver por" }).locator("label").filter({ hasText: new RegExp(`^${nome}$`) });
  await verPor("OP").click();
  await expect(page).toHaveURL(/ver=op/);
  // Filtro por OP: só a 4309 fica no Gantt.
  await page.getByLabel("Buscar OP").fill("4309");
  await expect(page.getByText(/^1 de \d+ OPs$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "OP 4309" })).toBeVisible();
  await expect(page.getByRole("link", { name: "OP 4310" })).toHaveCount(0);
  await expect(page.getByText("Data de entrega")).toBeVisible();
  await page.locator("#gantt").screenshot({ path: "test-results/capturas/gantt-por-op.jpg", type: "jpeg", quality: 35 });

  // Arrastar na visão por OP gera nova versão e mantém visão e filtro.
  const barra = page.locator('button[aria-label^="OP 4309 · Corte ·"]');
  await arrastar(page, barra, 220);
  await expect(page).toHaveURL(/versao=.*ver=op|ver=op.*versao=/, { timeout: 30_000 });
  await expect(page.getByText("Sugerida · aguardando aprovação")).toBeVisible();
  await expect(page.getByLabel("Buscar OP")).toHaveValue("4309");

  // Ver por cliente, filtrando um cliente.
  await page.getByRole("button", { name: "Limpar filtros" }).first().click();
  await verPor("Cliente").click();
  await page.locator("#filtro-cliente").selectOption("Solar Vale Energia");
  await expect(page.getByText(/^Solar Vale Energia · \d+ OPs?$/)).toBeVisible();
  await expect(page.getByText(/^Hospital Santa Clara · /)).toHaveCount(0);

  // Situação "Com data fixada": aparecem as OPs arrastadas.
  await page.locator("#filtro-cliente").selectOption("");
  await page.getByLabel("Situação").selectOption("fixadas");
  await expect(page.getByRole("link", { name: "OP 4309" })).toBeVisible();
  await page.locator("#gantt").screenshot({ path: "test-results/capturas/gantt-fixadas.jpg", type: "jpeg", quality: 35 });

  // Volta à visão por recurso sem filtros.
  await page.getByRole("button", { name: "Limpar filtros" }).first().click();
  await verPor("Cliente").click();
  await page.locator("#gantt").screenshot({ path: "test-results/capturas/gantt-por-cliente.jpg", type: "jpeg", quality: 35 });
  await verPor("Recurso").click();
  await expect(page.getByText("Puncionadeira CNC").first()).toBeVisible();
});

test("Gantt: painel de detalhes explica a posição e a versão é aprovada", async () => {
  await abrir(page, "/programacao");
  await page.locator('button[aria-label^="OP 4306 · Corte ·"]').click();
  await expect(page.getByRole("heading", { name: "OP 4306 · Corte" })).toBeVisible();
  await expect(page.getByText("Por que está aqui")).toBeVisible();
  await page.getByRole("button", { name: "Aprovar programação" }).click();
  await expect(page.getByText("Aprovada · em vigor")).toBeVisible({ timeout: 30_000 });
});

test("visão geral abre com indicadores, gráfico e listas", async () => {
  await abrir(page, "/visao-geral");
  await expect(page.getByRole("heading", { name: /Visão geral/ })).toBeVisible();
  for (const rotulo of ["Entregas no prazo", "Produtos acabados", "Qualidade", "OPs concluídas", "OPs em carteira", "Carga programada", "Ocupação dos recursos", "Tempo parado"]) {
    await expect(page.getByRole("heading", { name: new RegExp(rotulo) })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: /Produção diária/ })).toBeVisible();
  // O histórico da demonstração gera barras no gráfico.
  await expect(page.getByRole("button", { name: /boas, \d+ rejeitadas/ }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ocupação por centro" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "OPs em risco" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Principais paradas" })).toBeVisible();
  await expect(page.getByText("Falta de material").first()).toBeVisible();
  // Nenhum indicador principal vazio com a demonstração carregada.
  await expect(page.locator("article").filter({ hasText: "Entregas no prazo" }).getByText("%").first()).toBeVisible();

  await page.getByRole("button", { name: /boas, \d+ rejeitadas/ }).nth(25).hover();
  await page.screenshot({ path: "test-results/capturas/visao-geral-1.jpg", type: "jpeg", quality: 32 });
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/capturas/visao-geral-2.jpg", type: "jpeg", quality: 32 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/visao-geral");
  await page.screenshot({ path: "test-results/capturas/visao-geral-celular.jpg", type: "jpeg", quality: 28 });
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("OP criada pode ser reaberta pela lista, antes e depois de liberar", async () => {
  await abrir(page, "/ordens/nova");
  await page.getByLabel("Código da OP").fill("9001");
  await page.getByLabel("Produto").selectOption({ index: 0 });
  await page.getByLabel("Quantidade").fill("2");
  await page.getByLabel("Data de entrega").fill("2026-12-15");
  await page.getByRole("button", { name: "Criar OP" }).click();
  await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "OP 9001" })).toBeVisible();
  const urlDaOp = page.url().split("?")[0];

  // Sai da tela e volta pela lista.
  await abrir(page, "/painel");
  await abrir(page, "/ordens");
  // Clique em qualquer parte da linha (aqui, na coluna do produto) abre a OP.
  await page.getByRole("row").filter({ hasText: "9001" }).getByRole("cell").nth(1).click();
  await expect(page).toHaveURL(new RegExp(urlDaOp.replace(/^.*\/ordens/, "/ordens") + "$"));
  await expect(page.getByRole("heading", { name: "OP 9001" })).toBeVisible();
  // E o link do código continua funcionando.
  await abrir(page, "/ordens");
  await page.getByRole("link", { name: "9001", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(urlDaOp.replace(/^.*\/ordens/, "/ordens") + "$"));
  await expect(page.getByRole("heading", { name: "OP 9001" })).toBeVisible();
  await expect(page.getByText("Não conseguimos carregar esta página")).toHaveCount(0);

  // Abrindo direto pelo endereço.
  await page.goto(urlDaOp);
  await expect(page.getByRole("heading", { name: "OP 9001" })).toBeVisible();

  // Depois de liberar, sair e voltar.
  await page.getByRole("button", { name: "Liberar para produção" }).click();
  await expect(page.getByText("OP liberada")).toBeVisible();
  await abrir(page, "/ordens?q=9001");
  await page.getByRole("link", { name: "9001", exact: true }).click();
  await expect(page.getByRole("heading", { name: "OP 9001" })).toBeVisible();
  await expect(page.getByText("Não conseguimos carregar esta página")).toHaveCount(0);

  // A lista abre só com OPs em aberto; "Todas" mostra também as concluídas.
  await abrir(page, "/ordens");
  await expect(page.getByRole("link", { name: "4101", exact: true })).toHaveCount(0);
  await abrir(page, "/ordens?status=todas&ordem=codigo");
  await expect(page.getByRole("link", { name: "4101", exact: true })).toBeVisible();

  // OP da demonstração (já em execução, com apontamentos) também abre.
  await abrir(page, "/ordens?q=4301");
  await page.getByRole("link", { name: "4301", exact: true }).click();
  await expect(page.getByRole("heading", { name: "OP 4301" })).toBeVisible();
  await expect(page.getByText("Não conseguimos carregar esta página")).toHaveCount(0);
});

test("terminal: iniciar, pausar com motivo, retomar e finalizar", async () => {
  await abrir(page, "/terminal");
  // Na demonstração, a Dobra da OP 4303 está liberada (o Corte já foi concluído).
  await page.getByRole("link", { name: /Dobradeira/ }).click();
  await page.getByLabel("Operador").selectOption({ label: "1001 · Bruno Lima" });
  const iniciar = page.getByRole("button", { name: /^Iniciar OP/ }).and(page.locator(":not([disabled])")).first();
  await iniciar.click();
  await expect(page.getByText(/Início registrado/)).toBeVisible();
  await page.getByRole("button", { name: "Pausar" }).click();
  await page.getByRole("button", { name: /Falta de material/ }).click();
  await expect(page.getByText(/Pausa registrada/)).toBeVisible();
  await page.getByRole("button", { name: "Retomar" }).click();
  await expect(page.getByText(/Retomada registrada/)).toBeVisible();
  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.getByLabel("Quantidade boa").fill("1");
  await page.getByRole("button", { name: "Confirmar finalização" }).click();
  await expect(page.getByText(/Finalização registrada|excedente/)).toBeVisible();
  await page.screenshot({ path: "test-results/03-terminal.png", fullPage: true });
});

test("painel abre com indicadores e Pareto", async () => {
  await abrir(page, "/painel");
  await expect(page.getByRole("heading", { name: "OPs que pedem atenção" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Paradas dos últimos/ })).toBeVisible();
  await expect(page.getByText("Falta de material").first()).toBeVisible();
  await page.screenshot({ path: "test-results/04-painel.png", fullPage: true });
});

test("perfil operador só acessa o terminal", async () => {
  await abrir(page, "/usuarios");
  await page.getByLabel("Nome", { exact: true }).fill(OPERADOR.nome);
  await page.getByLabel("E-mail").fill(OPERADOR.email);
  await page.getByLabel("Senha inicial").fill(OPERADOR.senha);
  await page.getByLabel("Perfil", { exact: true }).selectOption("operador");
  await page.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByText("Usuário criado")).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar/);

  await entrar(page, OPERADOR.email, OPERADOR.senha);
  await expect(page).toHaveURL(/\/terminal/);
  await page.goto("/programacao");
  await expect(page).toHaveURL(/\/terminal/);
  await page.goto("/ordens");
  await expect(page).toHaveURL(/\/terminal/);
});
