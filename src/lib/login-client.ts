type LoginPayload = { error?: unknown; redirectTo?: unknown };

export async function signIn(email: string, password: string, fetcher: typeof fetch = fetch): Promise<"/coordenacao" | "/professor"> {
  let response: Response;
  try {
    response = await fetcher("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Não foi possível acessar a API de login. Confira o endereço da aplicação e se o servidor está em execução.");
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`A API de login respondeu HTTP ${response.status} sem JSON. Confira se esta versão do servidor está publicada e consulte o terminal ou os logs do deploy.`);
  }

  let data: LoginPayload;
  try { data = await response.json() as LoginPayload; }
  catch { throw new Error(`A API de login respondeu HTTP ${response.status} com JSON inválido. Consulte os logs do servidor.`); }

  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Não foi possível entrar (HTTP ${response.status}).`);
  if (data.redirectTo !== "/coordenacao" && data.redirectTo !== "/professor") {
    throw new Error("A API de login não informou o destino esperado. Consulte os logs do servidor.");
  }
  return data.redirectTo;
}
