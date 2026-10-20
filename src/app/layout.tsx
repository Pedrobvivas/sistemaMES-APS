import "@fontsource-variable/inter";
import "@fontsource-variable/montserrat";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import type { Metadata } from "next";
import { appName } from "@/lib/utils";

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description: "Sistema desenvolvido pela Camargo TI.",
};

// Aplica o tema salvo antes da página aparecer (evita piscar).
const scriptTema = `try{var t=localStorage.getItem("tema");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
