import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta: sobem o build de produção e usam o banco do DATABASE_URL.
// Rodam em sequência porque compartilham o mesmo banco.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // No CI, "github" transforma cada falha em anotação legível na própria execução.
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 900 },
    screenshot: "on",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    // Mesmo servidor da imagem Docker (output: standalone).
    command: "cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/ && HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js",
    url: "http://localhost:3000/entrar",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
