export const instant = false;
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, homeFor } from "@/lib/auth/core";
import { currentUser } from "@/lib/auth/server";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await currentUser((await cookies()).get(ACCESS_COOKIE)?.value);
  if (user) redirect(homeFor(user.role));
  return children;
}
