# Simulado CLA

Plataforma do Colégio Leonel Amorim para organizar turmas, alunos, professores e simulados. A coordenação gerencia os cadastros e os simulados; o professor consulta simulados e seus status. Os cartões-resposta são gerados em PDF no servidor para os alunos da turma do simulado.

## Estado atual

- [Etapa 2](etapa-2.md): Prisma/PostgreSQL, autenticação, autorização, login/logout e CRUDs de turmas, alunos e professores.
- [Etapa 3](etapa-3.md): CRUD de simulados, listagem e status no painel do professor, geração de PDF A4 com dois cartões por página.
- [Etapa 4](etapa-4-correcao.md): layout óptico versionado, análise de imagens e PDF, revisão obrigatória, confirmação transacional e ranking real.
- [Migração OMR para Python](migracao-omr-python.md): arquitetura atual, arquivos substituídos, comandos, medições, implantação e testes físicos pendentes.
- [Gabarito dos resultados confirmados](gabarito-confirmado.md): botão na tabela, cartão individual, cores e respostas persistidas.
- [Frontend](frontend.md): rotas, telas e limites atuais.

Em 7 de novembro de 2026, `npm run db:status` confirmou **três migrations aplicadas e esquema em dia** no Neon configurado nesta cópia, inclusive a de correções. Ainda é preciso identificar formalmente o ambiente de produção e executar um fluxo autenticado completo de gravação/consulta, além de testar cartões físicos antes do uso operacional. O motor óptico atual usa FastAPI/OpenCV; a [etapa 4](etapa-4-correcao.md) registra também o histórico do motor Node anterior.

## Desenvolvimento local

`npm run dev` usa Webpack, assim como o build do projeto. Em 7 de novembro de 2026, o navegador apresentou recarregamentos repetidos com o servidor Turbopack e o cliente HMR registrou uma falha ao carregar um chunk. Ao reiniciar o servidor com `next dev --webpack`, a página de coordenação carregou e não repetiu as requisições durante a observação local. A causa exata da falha no Turbopack ainda não foi isolada; se o navegador mantiver uma aba antiga, recarregue-a uma vez após reiniciar o servidor.
