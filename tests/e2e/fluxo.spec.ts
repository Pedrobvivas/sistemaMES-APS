// Fluxo completo do protótipo no navegador, com o build de produção e banco real:
// configuração → demonstração → Gantt com arraste → aprovação → terminal → perfis.
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { nome: "Admin Teste", email: "admin@teste.local", senha: "senha-forte-123" };
const OPERADOR = { nome: "Operador Teste", email: "operador@teste.local", senha: "senha-forte-456" };

test.describe.configure({ mode: "serial" });

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

test("configuração inicial e carga da demonstração", async ({ page }) => {
  await page.goto("/configurar");
  await page.getByLabel("Seu nome").fill(ADMIN.nome);
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.senha);
  await page.getByRole("button").filter({ hasText: /criar|configurar|começar/i }).first().click();
  await expect(page).toHaveURL(/\/entrar/);

  await entrar(page, ADMIN.email, ADMIN.senha);
  await expect(page).toHaveURL(/\/painel/);

  await abrir(page, "/sistema");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Carregar demonstração" }).click();
  await expect(page.getByText("Dados de demonstração carregados e programação aprovada")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Demonstração · dados fictícios")).toBeVisible();
});

test("Gantt: arrastar a OP gera versão sugerida com antes × depois e data fixada", async ({ page }) => {
  await entrar(page, ADMIN.email, ADMIN.senha);
  await abrir(page, "/programacao");
  await expect(page.getByText("Aprovada · em vigor")).toBeVisible();
  await page.screenshot({ path: "test-results/01-gantt-aprovado.png", fullPage: true });

  const barra = page.locator('button[aria-label^="OP 4310 · Corte."]');
  await expect(barra).toBeVisible();
  await expect(barra).not.toHaveAttribute("aria-label", /Data fixada/);

  await arrastar(page, barra, 330); // ~30 h à direita na escala Semana
  await expect(page).toHaveURL(/versao=/, { timeout: 30_000 });
  await expect(page.getByText("Sugerida · aguardando aprovação")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Antes × depois/ })).toBeVisible();
  await expect(page.locator('button[aria-label^="OP 4310 · Corte."]')).toHaveAttribute("aria-label", /Data fixada/);
  await expect(page.getByText(/OP 4310 movida para começar em/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/02-gantt-sugerido.png", fullPage: true });
});

test("Gantt: só a operação, antes da anterior, é recusado com explicação", async ({ page }) => {
  await entrar(page, ADMIN.email, ADMIN.senha);
  await abrir(page, "/programacao");
  await page.getByText("Só a operação", { exact: true }).click();
  const corte = page.locator('button[aria-label^="OP 4310 · Corte."]');
  const dobra = page.locator('button[aria-label^="OP 4310 · Dobra."]');
  await dobra.scrollIntoViewIfNeeded();
  const [cx, dx] = [await corte.boundingBox(), await dobra.boundingBox()];
  if (!cx || !dx) throw new Error("barras sem posição");
  // Solta a Dobra logo depois do início do Corte (antes de ele terminar).
  await arrastar(page, dobra, cx.x + 4 - dx.x);
  await expect(page.getByRole("alert").filter({ hasText: /Depende de "Corte"/ })).toBeVisible();
  await expect(page.getByText("Sugerida · aguardando aprovação")).toBeVisible(); // nada mudou
});

test("Gantt: painel de detalhes explica a posição e a versão é aprovada", async ({ page }) => {
  await entrar(page, ADMIN.email, ADMIN.senha);
  await abrir(page, "/programacao");
  await page.locator('button[aria-label^="OP 4306 · Corte."]').click();
  await expect(page.getByRole("heading", { name: "OP 4306 · Corte" })).toBeVisible();
  await expect(page.getByText("Por que está aqui")).toBeVisible();
  await page.getByRole("button", { name: "Aprovar programação" }).click();
  await expect(page.getByText("Aprovada · em vigor")).toBeVisible({ timeout: 30_000 });
});

test("terminal: iniciar, pausar com motivo, retomar e finalizar", async ({ page }) => {
  await entrar(page, ADMIN.email, ADMIN.senha);
  await abrir(page, "/terminal");
  await page.getByRole("link", { name: /Bancada de testes|Puncionadeira CNC/ }).first().click();
  await page.getByLabel("Operador").selectOption({ label: "1001 · Bruno Lima" });
  const iniciar = page.getByRole("button", { name: /^Iniciar OP/ }).and(page.locator(":not([disabled])")).first();
  if ((await iniciar.count()) === 0) test.skip(true, "Nenhuma operação liberada para iniciar neste recurso agora.");
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

test("painel abre com indicadores e Pareto", async ({ page }) => {
  await entrar(page, ADMIN.email, ADMIN.senha);
  await abrir(page, "/painel");
  await expect(page.getByRole("heading", { name: "OPs que pedem atenção" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Paradas dos últimos/ })).toBeVisible();
  await expect(page.getByText("Falta de material").first()).toBeVisible();
  await page.screenshot({ path: "test-results/04-painel.png", fullPage: true });
});

test("perfil operador só acessa o terminal", async ({ page }) => {
  await entrar(page, ADMIN.email, ADMIN.senha);
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
