import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { ACCESS_COOKIE, homeFor } from "@/lib/auth/core";
import { currentUser } from "@/lib/auth/server";

export const instant = false;

export default async function LoginPage() {
  const user = await currentUser((await cookies()).get(ACCESS_COOKIE)?.value);
  if (user) redirect(homeFor(user.role));
  return <LoginForm />;
}
