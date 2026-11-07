# Etapa 2: persistência, autenticação e cadastros

## Arquivos e módulos

- `src/app` contém as rotas preservadas e as novas APIs. `src/components` mantém os componentes da primeira etapa. Na entrega original desta etapa, simulados e resultados ainda eram demonstrativos; as Etapas 3 e 4 substituíram esse comportamento por APIs persistentes. O `DataProvider` atual carrega turmas, alunos, professores e simulados do servidor.
- `src/proxy.ts` verifica a assinatura e o prazo do access token antes da navegação, aplica a separação inicial de papéis e encaminha tokens expirados para renovação. Os layouts protegidos e as APIs validam a sessão e o usuário no banco. Os layouts com leitura de cookie usam `instant = false`, conforme o guia local de Cache Components do Next.js 16, porque a verificação precisa ocorrer na requisição.
- `src/lib/auth` contém assinatura e verificação de JWT, sessão, cookies, autorização, validação e erros. `src/lib/prisma.ts` reutiliza o Prisma Client com o adaptador PostgreSQL. `src/lib/client-api.ts` renova o access token e repete uma chamada após resposta 401.
- `prisma/schema.prisma`, `prisma.config.ts` e `prisma/migrations/20261107000000_initial/migration.sql` definem o esquema e a primeira migration. `scripts/create-coordinator.ts` é o único mecanismo inicial de criação de coordenadores.
- `src/app/globals.css` aumenta a tipografia da interface em cerca de 2px e ajusta a altura dos campos e botões. `eslint.config.mjs` ignora a cópia local do gerador de QR em seu novo caminho.

## Modelos

| Modelo | Finalidade |
| --- | --- |
| `User` | UUID, nome, sobrenome, e-mail único, hash Argon2id, papel `COORDENACAO` ou `PROFESSOR`, status `ATIVO` ou `INATIVO`, datas |
| `Classroom` | UUID, nome único, datas e alunos vinculados |
| `Student` | UUID, nome, sobrenome, turma obrigatória, datas |
| `Session` | UUID, usuário, hash do refresh token, prazo absoluto, revogação e última rotação |
| `LoginThrottle` | Contagem de tentativas por hash do e-mail em janela de 15 minutos |

A migration cria chaves estrangeiras e índices. Alunos impedem a exclusão da turma pela API e pela constraint `RESTRICT`. A migration também cria índices únicos sem distinção de maiúsculas para e-mail e nome da turma. Professor tem role fixada no servidor; payloads com role são rejeitados.

## Configuração e comandos

Use Node.js compatível com Next.js 16 e instale as dependências com `npm ci`. O `postinstall` gera o Prisma Client também no ambiente de build. Copie `.env.example` para `.env` e preencha:

- `DATABASE_URL`: conexão pooled do Neon, usada pela aplicação.
- `DIRECT_URL`: conexão direta do Neon, usada pela CLI Prisma e pelo script manual de coordenador.
- `JWT_ACCESS_SECRET`: segredo aleatório de pelo menos 32 bytes para access JWT.
- `JWT_REFRESH_SECRET`: segredo independente de pelo menos 32 bytes para refresh JWT.
- `NODE_ENV`: `development` localmente; `production` no deploy.

O arquivo `.env` é ignorado pelo Git. Não coloque segredos no código nem nos logs.

```bash
npm ci
npm run db:generate
npm run db:status
npm run db:deploy
npm run create:coordinator
npm run dev
```

`db:status` é uma leitura de estado; revise o destino e o SQL antes de `db:deploy`. Em 7 de novembro de 2026, `npm run db:status` confirmou que a migration já havia sido aplicada no banco configurado; essa operação foi feita fora deste diagnóstico. `npm run create:coordinator` pede nome, sobrenome, e-mail, senha e confirmação em terminal interativo; a senha não aparece. Execute-o manualmente quando precisar cadastrar a coordenação. Em desenvolvimento de novas migrations, use `npm run db:migrate` contra um banco de desenvolvimento apropriado. O build e o deploy não executam migrations ou criam coordenadores automaticamente.

## Autenticação e segurança

O login consulta o usuário, verifica Argon2id e o status ativo, cria uma sessão e envia dois JWT em cookies HTTP-only, `SameSite=Strict` e `Secure` em produção. O access token dura 15 minutos. O refresh token dura no máximo 30 dias desde o login; seu hash SHA-256, e não o token, fica na tabela `Session`. Cada renovação troca o refresh token de forma atômica por comparação de hash. O token anterior perde validade; reutilização posterior revoga a sessão. Uma janela de 10 segundos responde com conflito em caso de renovações simultâneas, sem revogar uma sessão legítima. O cliente evita renovações paralelas na aba e tenta novamente após conflito.

Navegação com access token expirado passa por `/api/auth/renew`; chamadas da interface recebem renovação automática e nova tentativa após 401. A interface também revalida a sessão quando volta a ficar visível e a cada 14 minutos enquanto aberta. O prazo absoluto de 30 dias não é estendido. Logout revoga a sessão no banco, apaga os cookies e redireciona a `/login`. A conta inativa e a sessão revogada falham nas verificações autoritativas do backend, mesmo com access token ainda assinado.

O Proxy é só a primeira camada. Layouts e endpoints consultam sessão e usuário no servidor. Requisições de escrita exigem `Origin` da própria aplicação e, quando presente, `Sec-Fetch-Site: same-origin`; cookies Strict reduzem CSRF. Login tem limite persistido de oito tentativas por e-mail em 15 minutos. Entradas JSON são validadas com Zod; erros de recursos inexistentes, duplicações e relações inválidas têm respostas controladas. Senhas, hashes e tokens não são retornados pelas APIs.

## Rotas e permissões

| Rota | Permissão |
| --- | --- |
| `/login`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/renew` | Pública; renovação exige refresh token válido |
| `/api/auth/me`, `/api/auth/logout`, `/api/qr/[studentId]` | Usuário autenticado, com verificações próprias |
| `/coordenacao/**`, `/api/admin/**` | Somente `COORDENACAO` |
| `/professor/**`, `/cartoes/**` | `PROFESSOR` ou `COORDENACAO` |

As APIs REST `/api/admin/classrooms`, `/api/admin/students` e `/api/admin/teachers` oferecem `GET` e `POST`; suas rotas `/[id]` oferecem `PATCH` e `DELETE`. `GET /api/admin/students?classroomId=UUID` filtra por turma. Todas as mutações são restritas à coordenação. `POST /api/admin/teachers` recebe senha inicial; `PATCH` aceita apenas nome, sobrenome, e-mail e status. Ao inativar, as sessões são revogadas na mesma transação. Não existe rota pública para criar coordenadores.

## Validação e limites desta entrega

Executados localmente: `npm run db:generate`, `npx prisma validate`, `npx next typegen`, `npm run typecheck`, `npm run lint` e `npm run test`. Os testes cobrem assinatura, audience, expiração e papel de JWT, atributos dos cookies, redirecionamento inicial do Proxy, rejeição de campos proibidos nos payloads, resposta 401 das APIs administrativas anônimas e proteção de origem nas escritas. Um teste HTTP do build local confirmou `/login` com 200, redirecionamento de `/coordenacao` e `/professor` para `/login`, e 401 em `/api/admin/classrooms` e `/api/auth/me` sem sessão. A execução real de login com credenciais válidas, logout, renovação, permissões, persistência e CRUD contra Neon ainda não foi verificada nesta entrega. Nenhum banco foi alterado aqui.

O build de produção passou com permissão para criar subprocessos. No sandbox padrão, a chamada interna do Next.js ao TypeScript falha por bloqueio de subprocessos; o comando TypeScript direto passa. O build foi feito sem credenciais de banco e não comprova conexão ou migração no Neon.

Na entrega original da Etapa 2, simulados, correções, ranking e cartões ainda eram demonstrativos. Consulte as Etapas 3 e 4 para o estado atual; cartões antigos e prévias HTML não devem ser usados como cartões oficiais de leitura óptica.

## Diagnóstico da mensagem de login (7 de novembro de 2026)

A mensagem antiga **“Não foi possível conectar ao servidor”** aparecia para qualquer exceção no bloco do formulário, inclusive ao interpretar uma resposta não JSON ou ao atualizar a sessão depois de um login aceito. A tela agora distingue falha de rede, resposta HTTP sem JSON, JSON inválido e erro da API. Depois de um login aceito, faz uma navegação completa para que os layouts e o provedor de dados leiam os novos cookies.

Nesta investigação, as variáveis necessárias estavam presentes, `prisma migrate status` confirmou o esquema atualizado no Neon e havia um coordenador ativo. A API local de desenvolvimento e a de produção responderam `401` em JSON para credenciais de diagnóstico inexistentes. Não havia sessões registradas na leitura realizada. O usuário informou `http://localhost:3000/login`; nessa porta, a conexão era recusada porque não havia servidor em execução. Após iniciar `npm run dev -- -p 3000`, `GET /login` respondeu `200`, `GET /api/auth/me` respondeu `401` sem sessão, e `POST /api/auth/login` respondeu `401` em JSON para credenciais inexistentes. A tela agora informa explicitamente quando não consegue alcançar a API. Para tentar entrar, mantenha o servidor em execução e atualize a página. O login com a senha real não foi reproduzido; nenhuma credencial foi lida ou exposta e nenhum registro do banco foi alterado pelo diagnóstico. Depois do ajuste, `npm run test`, `npm run lint`, `npm run typecheck` e `npm run build` passaram; o teste novo cobre erros da API, resposta não JSON, falha de rede e destino de redirecionamento.
