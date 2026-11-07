import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { hash, argon2id } from "argon2";
import { name, email, password } from "../src/lib/auth/validators";

function hiddenQuestion(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Execute em um terminal interativo.");
  process.stdout.write(label);
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const done = (error?: Error) => {
      process.stdin.setRawMode(false);
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      const char = chunk.toString("utf8");
      if (char === "\r" || char === "\n") done();
      else if (char === "\u0003") done(new Error("Cancelado."));
      else if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
      else if (!/[\u0000-\u001f]/.test(char)) value += char;
    };
    process.stdin.on("data", onData);
  });
}
async function main() {
  if (!process.env.DIRECT_URL) throw new Error("Configure DIRECT_URL antes de executar.");
  process.env.DATABASE_URL = process.env.DIRECT_URL;
  const { getPrisma } = await import("../src/lib/prisma");
  const prisma = getPrisma();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const firstName = name.parse(await rl.question("Nome: "));
    const lastName = name.parse(await rl.question("Sobrenome: "));
    const address = email.parse(await rl.question("E-mail: "));
    rl.pause();
    if (await prisma.user.findUnique({ where: { email: address } })) throw new Error("Este e-mail já está cadastrado.");
    const pass = password.parse(await hiddenQuestion("Senha: "));
    const confirmation = await hiddenQuestion("Confirme a senha: ");
    if (pass !== confirmation) throw new Error("As senhas não coincidem.");
    await prisma.user.create({ data: { firstName, lastName, email: address, passwordHash: await hash(pass, { type: argon2id }), role: "COORDENACAO", status: "ATIVO" } });
    process.stdout.write("Coordenador criado com sucesso.\n");
  } finally { rl.close(); await prisma.$disconnect(); }
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Falha ao criar coordenador."}\n`); process.exitCode = 1; });
