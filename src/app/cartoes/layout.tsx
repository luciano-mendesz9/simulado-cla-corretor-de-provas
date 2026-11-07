export const instant = false;
import { requirePage } from "@/lib/auth/server";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePage(["PROFESSOR", "COORDENACAO"]);
  return children;
}
