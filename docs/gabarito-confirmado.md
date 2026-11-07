# Gabarito dos resultados confirmados

Atualizado em 7 de novembro de 2026.

## O que mudou

Na tabela **Resultados confirmados** das páginas de simulado da coordenação e do professor, a coluna **Gabarito** tem um botão laranja **Ver gabarito** em cada linha. O botão abre uma janela com o cartão-resposta individual, desenhado nas mesmas coordenadas e quatro colunas do PDF oficial. O cabeçalho mostra simulado, aluno, turma e data de aplicação. A área do QR é substituída pelo aviso de gabarito confirmado: o QR e a imagem original não são armazenados depois da confirmação. O cartão pode ser rolado horizontalmente em telas pequenas; a janela fecha pelo botão, pela tecla Escape ou por clique fora dela.

As bolinhas têm três estados visuais:

- **Verde com 28% de opacidade:** alternativa correta que o aluno não marcou, inclusive em questão em branco.
- **Verde com 100% de opacidade:** alternativa correta que o aluno marcou.
- **Vermelho com 100% de opacidade:** alternativa incorreta marcada pelo aluno.

As outras alternativas continuam brancas. Em uma questão de múltipla marcação, a alternativa correta marcada aparece em verde e cada alternativa incorreta marcada aparece em vermelho; a questão continua valendo zero pela regra de correção. A legenda na janela explica as cores.

## Origem e persistência dos dados

Na confirmação, a rota `POST /api/corrections/confirm` já grava `Correction` e uma linha `CorrectionAnswer` por questão na mesma transação serializável. Cada resposta salva inclui número da questão, alternativas marcadas, alternativa correta, estado, pontuação e indicação de revisão manual. O novo gabarito deriva as cores desses valores **persistidos no momento da confirmação**. Não depende do gabarito atual na memória do navegador nem da foto temporária. Não foi necessária migration, gravação adicional ou alteração das notas; resultados já confirmados também podem ser exibidos.

O botão chama `GET /api/exams/[id]/results/[correctionId]` somente quando aberto. A rota exige sessão ativa de coordenação ou professor, limita a busca ao simulado da página, valida a sequência e consistência das respostas e devolve apenas os campos necessários ao cartão. A resposta não é armazenada em cache. O ranking continua carregando sem trazer todas as respostas de todos os alunos.

## Verificação e limites

Os testes automatizados verificam o mapeamento das quatro situações relevantes: acerto, erro, branco e múltipla marcação; a rota nova rejeita acesso anônimo. TypeScript, lint e build Webpack passaram. Um cartão fictício de dez questões foi renderizado em SVG e PNG e inspecionado visualmente: as posições, as quatro colunas, as cores e a opacidade ficaram legíveis. Em consulta **somente de leitura** ao Neon configurado nesta cópia, havia uma correção confirmada e dez respostas persistidas, completas e consistentes. Não foi feita gravação no banco nem ensaio autenticado da janela com uma sessão real de usuário. A interface usa os dados persistidos; a imagem escaneada original continua indisponível após recarregar a página.
