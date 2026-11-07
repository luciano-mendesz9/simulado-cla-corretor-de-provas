# Etapa 3 — Simulados persistentes e cartões-resposta em PDF

Atualizado em 7 de novembro de 2026.

## O que foi implementado

- `Exam` no Prisma: nome, turma, quantidade de questões (1–100), data de aplicação, abertura e fechamento da correção, gabarito JSON, datas de criação e atualização. A migration aditiva está em `prisma/migrations/20261107010000_add_exams/`.
- A Etapa 4 preserva o limite de 100 no esquema antigo para não alterar registros existentes, mas a criação e edição atuais aceitam até 40 questões, capacidade do novo cartão óptico. Um simulado antigo acima de 40 permanece consultável e precisa ser adaptado antes de gerar cartões `CLA2`.
- CRUD de simulados no servidor. A coordenação cria, edita e exclui; coordenação e professor listam e consultam. O backend verifica a sessão e o papel em cada requisição. Entradas JSON são validadas, inclusive a ordem das datas e a faixa das questões do gabarito.
- Painéis de coordenação e professor exibem os mesmos simulados persistidos. O status exibido é calculado pela data da aplicação e pelo período cadastrado: aguardando aplicação, em aplicação, aberto para correção ou fechado para correção. Esse status **não** indica que a correção automática esteja operacional.
- `GET /api/exams/[id]/cards.pdf` gera no servidor um PDF A4 com **dois cartões por página** para todos os alunos atualmente cadastrados na turma do simulado, ordenados por sobrenome e nome. Uma turma vazia recebe `409` com mensagem explícita. Cada cartão contém escola, simulado, nome, turma, data, UUID do aluno, questões A–E, marcações de orientação, assinatura e QR com os IDs do simulado e do aluno (`CLA1|examId|studentId`). A prévia HTML também usa alunos reais e o mesmo conteúdo do QR.
- A exclusão de turma é bloqueada quando ela possui alunos **ou simulados** vinculados. Os exemplos antigos de simulados e resultados não são mais carregados do `localStorage` pela interface.

## Rotas

| Rota | Método | Acesso |
| --- | --- | --- |
| `/api/exams` | `GET` | Coordenação e professor |
| `/api/exams` | `POST` | Coordenação |
| `/api/exams/[id]` | `GET` | Coordenação e professor |
| `/api/exams/[id]` | `PATCH`, `DELETE` | Coordenação |
| `/api/exams/[id]/cards.pdf` | `GET` | Coordenação e professor |
| `/api/qr/[studentId]?examId=...` | `GET` | Coordenação e professor; IDs devem pertencer à mesma turma |

`POST` e `PATCH` recebem todos os campos do formulário, com `answerKey` como objeto de número de questão para alternativa A–E. `PATCH` substitui os dados editáveis do simulado. A API retorna datas em `AAAA-MM-DD` e um `className` de leitura para a interface. As respostas usam `Cache-Control: no-store`; o PDF usa `private, no-store` e baixa como anexo. Mutação exige origem da própria aplicação.

## Migração e operação

Na entrega original desta etapa, a migration foi criada e ainda estava pendente. Em consulta somente de leitura realizada em 7 de novembro de 2026, `npm run db:status` confirmou que `20261107010000_add_exams` já estava aplicada no banco Neon configurado. A migration de correções da Etapa 4 é distinta e permanece pendente. O build não aplica migrations.

O PDF usa uma cópia local do bundle `pdf-lib` 1.17.1, acompanhada da licença MIT em `src/lib/vendor/`. Essa forma mantém o build reprodutível no ambiente sem acesso ao registro npm. A geração é sob demanda; o PDF não é armazenado no banco ou no servidor. Alterações posteriores de turma, alunos ou simulado mudam os PDFs gerados dali em diante; arquivos já baixados não são atualizados. O PDF não contém o gabarito oficial.

## Validação e limites

`npx prisma validate`, `npm run db:generate`, `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passaram. Os testes cobrem validação de datas e gabarito, bloqueio de APIs anônimas e origem externa, além de PDF A4 com três alunos em duas páginas. Um PDF com 100 questões foi renderizado e inspecionado visualmente; a extração de texto confirmou nome, turma, data e questões. Com o servidor local reiniciado, `/login` respondeu `200`; `/api/exams` e `/api/exams/[id]/cards.pdf` responderam `401` sem sessão. **A impressão física e a leitura por scanner ainda precisam ser validadas antes de usar os cartões em operação.**

O CRUD e o download autenticados contra o Neon **não foram executados nesta entrega original**, porque exigiriam aplicar a migration e realizar escritas no banco configurado. Correção automática, upload, ranking e resultados ficaram fora da Etapa 3 e foram implementados em código na Etapa 4, ainda sujeitos à migration própria e validação operacional. O login e os cadastros da Etapa 2 continuam sujeitos às validações operacionais próprias.
