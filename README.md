# Simulado CLA

Plataforma do Colégio Leonel Amorim para administrar turmas, alunos, professores e simulados, gerar cartões-resposta e revisar correções ópticas antes de registrar notas.

## Estado da entrega

O cadastro, a autenticação e os simulados usam Next.js, Prisma e PostgreSQL/Neon. A leitura óptica usa Python 3.12, OpenCV e FastAPI; Next.js valida os dados, calcula a nota e persiste a correção. PDF.js separa os cartões no navegador, com duas imagens processadas em paralelo, rascunhos temporários, confirmação explícita e ranking de notas confirmadas. O cartão aceita até 40 questões e usa QR assinado e quatro marcadores próprios em cada metade A4.

Em 7 de novembro de 2026, `npm run db:status` confirmou que as três migrations estão aplicadas no **Neon configurado nesta cópia**. Ainda falta confirmar se esse é o ambiente de produção desejado. O processamento foi validado com imagens sintéticas e PDFs gerados pelo sistema, mas ainda não com cartões impressos, preenchidos e fotografados por pessoas. Não use as notas em operação antes dessa validação física e de um ensaio autenticado de ponta a ponta.

## Início local

Use Node.js compatível com Next.js 16, Python 3.12 e `uv`. Copie `.env.example` para `.env.local` e configure `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OMR_SERVICE_URL=http://127.0.0.1:8001/` e `OMR_SHARED_SECRET` com valores próprios. Se você já usa `.env`, o comando `omr:dev` também o aceita. A URL do OMR deve apontar para o FastAPI na porta 8001, não para o Next.js na porta 3000. Não registre segredos no Git.

```bash
npm ci
UV_CACHE_DIR=/tmp/cla-uv-cache uv sync --project python --extra test
npm run db:status
npm run omr:dev
# Em outro terminal:
npm run dev
```

Antes de aplicar novas migrations em qualquer banco, confirme o destino e revise o SQL em `prisma/migrations/`. O build não executa migrations.

## Validação

```bash
npx prisma validate
npm run db:generate
npx next typegen
npm run typecheck
npm run lint
npm run test
npm run omr:test
npm run omr:benchmark
npm run build
```

O build utiliza Webpack para o ambiente deste projeto. Consulte [docs/README.md](docs/README.md) e [a documentação da migração OMR](docs/migracao-omr-python.md) para arquitetura, rotas, limites, medições e pendências operacionais.
