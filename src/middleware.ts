import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Rotas abertas, sem login.
const publicas = ["/entrar", "/esqueci-senha", "/redefinir-senha", "/configurar"];

// Filtro rápido: sem cookie de sessão, manda para o login.
// A checagem de verdade acontece no servidor (src/lib/session.ts).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicas.some((rota) => pathname.startsWith(rota))) return NextResponse.next();

  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Ignora a API de autenticação, arquivos estáticos e imagens.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
