import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { Card, CardTitulo } from "@/components/ui/card";
import { Badge, CabecalhoPagina } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { AcoesUsuario } from "./acoes-linha";
import { FormNovoUsuario } from "./form";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const { user: atual } = await requireAdmin();
  const usuarios = await db.select().from(user).orderBy(asc(user.name));

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Usuários" descricao="Quem tem acesso ao sistema. Só administradores veem esta tela." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Perfil</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <Td>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </Td>
                <Td>
                  <Badge tom={u.role === "admin" ? "destaque" : "neutro"}>
                    {u.role === "admin" ? "Administrador" : "Usuário"}
                  </Badge>
                </Td>
                <Td>
                  {u.id === atual.id ? (
                    <p className="text-right text-xs text-muted">Você</p>
                  ) : (
                    <AcoesUsuario id={u.id} nome={u.name} papel={u.role ?? "user"} />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <Card className="flex flex-col gap-4 self-start">
          <CardTitulo>Novo usuário</CardTitulo>
          <FormNovoUsuario />
        </Card>
      </div>
    </div>
  );
}
