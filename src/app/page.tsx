import { redirect } from "next/navigation";
import { inicioDoPapel } from "@/lib/papeis";
import { requireSession } from "@/lib/session";

export default async function Home() {
  const { user } = await requireSession();
  redirect(inicioDoPapel(user.role));
}
