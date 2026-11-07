# Frontend: rotas e comportamento atual

| Rota | Interface | Dados |
| --- | --- | --- |
| `/login` | Acesso por e-mail e senha | Autenticação via API |
| `/coordenacao` | Visão geral | Cadastros e simulados do servidor |
| `/coordenacao/turmas` | Cadastro de turmas | PostgreSQL/Neon após configuração |
| `/coordenacao/turmas/[turmaId]/alunos` | Cadastro de alunos | PostgreSQL/Neon após configuração |
| `/coordenacao/professores` | Contas de professores | PostgreSQL/Neon após configuração |
| `/coordenacao/simulados` e detalhes | CRUD de avaliações, gabarito, datas, correção e ranking | API persistente; correção exige migration da Etapa 4 |
| `/professor` e detalhes | Lista, cartões, correção e ranking dos mesmos simulados | API persistente; correção exige migration da Etapa 4 |
| `/cartoes/[simuladoId]` | Visualização do PDF oficial e botão **Baixar PDF** | Alunos atuais da turma; o mesmo arquivo é exibido e baixado |

A navegação de coordenação e professor permanece separada. As páginas e APIs verificam sessão e papel no servidor. O botão **Sair** revoga a sessão e volta a `/login`. Os formulários exibem carregamento, erro e sucesso, e recarregam os dados após salvar ou excluir.

A coordenação pode criar, editar e excluir simulados sem notas confirmadas. O professor pode listar e abrir os detalhes, com status calculado pelas datas configuradas. Ambos podem analisar cartões, conferir a prévia real, revisar leituras inconclusivas e confirmar correções no período configurado, após a migration da Etapa 4. O status “Aberto para correção” indica somente que a data está dentro do período configurado.

O PDF contém todos os alunos atualmente vinculados à turma do simulado, em duas fichas por folha A4. Se não houver alunos, o botão fica indisponível e a API retorna uma mensagem explicativa. A página mostra o próprio PDF oficial, sem uma prévia HTML com desenho diferente; use **Baixar PDF** para imprimir o layout óptico versionado em A4, sem ajustar a escala. É necessário validar a impressão física e a leitura do QR antes do uso operacional.
