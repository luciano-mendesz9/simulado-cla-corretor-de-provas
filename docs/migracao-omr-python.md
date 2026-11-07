# Migração do motor óptico para Python e OpenCV

Atualizado em 7 de novembro de 2026. O código foi implementado e validado localmente com imagens derivadas do PDF real; **a correção ainda não foi aprovada para notas operacionais**. Faltam cartões físicos, fluxo autenticado de confirmação e implantação/medição na Vercel. `npm run db:status` confirmou as três migrations em dia no Neon configurado nesta cópia; o ambiente de produção ainda precisa ser identificado formalmente.

## Estado anterior e o que foi preservado

O cartão PDF oficial já tinha duas metades A4, quatro marcadores geométricos personalizados por metade, QR `CLA2|2|examId|studentId|assinatura` e bolinhas em posições conhecidas. O QR continua assinado com `JWT_ACCESS_SECRET`; não foi criado um formato paralelo. A antiga prévia de quadrados sólidos não contém os marcadores atuais e continua incompatível. O cartão que contém só UUID de aluno não é aceito, porque não permite validar o simulado nem a assinatura com segurança.

Next.js, App Router, Prisma/Neon, `src/proxy.ts`, autenticação, permissões, CRUDs, PDFs, upload individual/lote, extração de PDF no navegador, revisão manual, confirmação, notas, auditoria e ranking não foram migrados. O Next.js continua verificando QR, simulado, aluno, turma, gabarito e período de correção; calcula o resultado e salva as alterações. Python não recebe o gabarito nem acessa o banco.

## Arquivos e contrato

- `python/shared/card-layout.v2.json`: única fonte das coordenadas do PDF e do OpenCV. O gerador TypeScript importa esse JSON em `src/lib/omr/layout.ts`.
- `python/omr/engine.py`: decodificação JPEG/PNG/WebP com EXIF, detecção dos quatro marcadores próprios por contorno, validação de tamanho/padrão, homografia OpenCV, QR e leitura de máscaras circulares. Valores intermediários são `UNCERTAIN` e exigem revisão.
- `python/main.py`: FastAPI `POST /analyze` com HMAC SHA-256 de timestamp, quantidade de questões e hash da imagem; relógio limitado a 120 s. Contrato de saída versão 1 validado por Pydantic. Não há endpoint público configurado para esse serviço.
- `src/lib/omr/index.ts`: adaptador com timeout de 25 s e contrato validado por Zod. Verifica assinatura do QR e simulado, transforma marcações técnicas em respostas oficiais e mantém o formato dos rascunhos existente.
- `vercel.json`: Services `web` e `omr`, binding privado `OMR_SERVICE_URL`, rewrite público apenas para `web`. `OMR_SHARED_SECRET` independente deve ser igual nos dois serviços; o binding sozinho não autentica chamadas.
- `python/tests/test_engine.py`, `python/benchmark.py`, `scripts/generate-omr-fixture.ts` e `tests/omr.test.ts`: cenários desde o gerador PDF real, testes do serviço e do adaptador.

O payload binário de imagem tem teto de 3,7 MB. A resposta JSON contém até dois cartões com marcações, coordenadas e uma prévia JPEG por cartão; cada prévia é limitada a 440 kB antes da codificação Base64, e o adaptador rejeita respostas com `Content-Length` acima de 1,6 MB. Essa opção mantém a prévia existente sem armazenamento no servidor, mas ainda deve ser medida na Vercel. O percentual técnico `confidence` reflete distância dos limiares e **não é probabilidade estatística calibrada**.

## Desenvolvimento local

Requer Node do projeto, Python 3.12, `uv` e Poppler (`pdftoppm`) para os testes de PDF. A instalação não altera o banco:

```bash
UV_CACHE_DIR=/tmp/cla-uv-cache uv sync --project python --extra test
npm run omr:test
npm run omr:benchmark
npm test
npm run typecheck
npm run lint
npm run build
```

Configure em `.env.local` `OMR_SERVICE_URL=http://127.0.0.1:8001/` e `OMR_SHARED_SECRET` aleatório com ao menos 32 bytes, além dos segredos já usados pela aplicação. Em dois terminais execute `npm run omr:dev` e `npm run dev`. O endpoint Python recebe somente chamada interna assinada; o navegador continua usando `/api/corrections/analyze` autenticado. `npm run omr:fixture -- /tmp/cartoes.pdf 10 2` gera dois cartões de teste em PDF com identidades fictícias. O segredo de teste embutido nesse script nunca deve ser usado em cartões reais.

### Diagnóstico de `OMR_BAD_RESPONSE` no ambiente local

Em 7 de novembro de 2026, `OMR_SERVICE_URL` estava configurada com o endereço do Next.js na porta 3000. O adaptador chamou `/analyze` nesse servidor, recebeu uma página em vez de JSON e apresentou `OMR_BAD_RESPONSE`. O exemplo de ambiente repetia a URL errada e continha um segredo preenchido. O exemplo agora aponta para `http://127.0.0.1:8001/` e deixa o segredo em branco. A configuração local existente foi corrigida; o valor do segredo não foi alterado. O comando `npm run omr:dev` agora lê `.env.local` quando existir e, caso contrário, `.env`, acompanhando o arquivo usado nesta cópia. Reinicie Next.js e FastAPI após mudar as variáveis. A porta 3000 continua sendo a interface web e a 8001 é o leitor Python; o navegador deve acessar a interface web, mas o Next.js deve chamar o leitor na 8001.

O adaptador agora indica que a URL não retornou JSON quando recebe HTML ou outra resposta não JSON. A verificação local iniciou FastAPI com `.env` e enviou uma requisição HTTP assinada com o print recebido: retornou `200`, `application/json`, `SUCCESS` e um cartão com dez leituras. `npm test` passou **7/7** arquivos, inclusive um novo caso para resposta HTML; TypeScript e lint passaram. Essa verificação não incluiu o fluxo autenticado da interface nem a gravação de nota.

## Validação realizada

Em Python 3.12.14, OpenCV headless 4.12.0.88 e NumPy 2.2.6, `npm run omr:test` passou **14/14** cenários. A suíte rasteriza o PDF gerado pelo projeto e cobre 10 e 40 questões, dois cartões, várias páginas, todos em branco, todos A/B, respostas variadas, dupla/tripla marcação, preenchimento parcial/na borda, marca fraca, rotação de 90°, perspectiva, sombra, ruído, resolução menor, QR ilegível/de outro simulado, marcador ausente, desfoque e autenticação interna. `npm test` passou **7/7** arquivos; lint, TypeScript e `npm run build` (Webpack) passaram. Uma chamada HTTP real do adaptador Next.js ao Uvicorn retornou dois cartões distintos de 40 questões, ambos em branco e com prévias. Esse ensaio não envolveu login nem banco. A imagem antiga de quadrados sólidos fornecida anteriormente recebeu `UNSUPPORTED_CARD_LAYOUT`, sem nota atribuída.

O benchmark repetível `npm run omr:benchmark` usou **8 cartões sintéticos derivados do PDF real**: seis cenários de resposta e dois casos de rejeição. Analisou 240 questões: 239 classificadas exatamente como esperado, 1 encaminhada à revisão, 0 falsas marcações, 0 marcações perdidas, 0 múltiplas incorretas e 0 respostas erradas silenciosas. Reconheceu 6 cartões e rejeitou 2 (`MARKERS_MISSING` e `BLURRY_IMAGE`). Média de **0,504 s** e máximo de **0,733 s** por imagem; pico de RSS **248,9 MiB** no processo de benchmark (inclui bibliotecas, PDF e imagens de teste em memória). Esses números não estimam precisão em fotografias físicas nem consumo isolado da Function.

### Correção para prints nítidos de 1045 × 728 pixels

Um print de cartão oficial preenchido digitalmente era rejeitado no navegador como `resolução insuficiente para ler as bolinhas`, antes de chegar ao leitor. O motivo era a exigência fixa de 800 pixels no lado menor, repetida no navegador e no Python. A imagem tinha 728 pixels nesse lado, mas os quatro marcadores, o QR e as bolinhas estavam nítidos. O limite foi reduzido para **700 pixels** nas duas camadas; imagens menores continuam rejeitadas. Não se amplia a imagem para mascarar falta de detalhes: a detecção de marcadores, QR, desfoque e respostas ainda precisa passar.

O print fornecido foi analisado localmente como PNG original e como JPEG de qualidade 88, equivalente à preparação feita no navegador. Em ambos, o leitor encontrou um cartão, leu o QR, identificou os quatro marcadores sem erros de padrão e classificou as dez questões: 1 A, 2 A, 3 C+D (múltipla), 4 em branco, 5 B, 6 E, 7 A, 8 B, 9 D e 10 A+E (múltipla). Não se registrou o arquivo, dados pessoais ou conteúdo do QR no repositório. Dois testes de regressão usam cartões fictícios gerados pelo PDF do projeto: um verifica a leitura em 1045 × 728; outro confirma rejeição abaixo de 700 pixels. Após a mudança, `npm run omr:test` passou **16/16** cenários, `npm test` passou **7/7** arquivos, e TypeScript, lint e build Webpack passaram. Esse teste valida a leitura local da imagem, não uma confirmação autenticada de nota no banco.

## Vercel e estado operacional

A configuração usa a sintaxe atual `services`, raiz `.` para Next.js e `python` para FastAPI, `main:app` como entrypoint e binding privado. A documentação atual da Vercel: [Services](https://vercel.com/docs/services), [configuração](https://vercel.com/docs/services/config-reference), [bindings](https://vercel.com/docs/services/bindings), [roteamento](https://vercel.com/docs/services/routing). Há apenas um rewrite público para `web`; `/analyze` do Python não é exposto. Configurar `OMR_SHARED_SECRET` nos dois serviços e confirmar a disponibilidade de Services no projeto são passos obrigatórios no painel. `OMR_SERVICE_URL` é injetada pelo binding no runtime; no desenvolvimento local é configurada manualmente.

A CLI Vercel 65.12.1 executou `vercel dev -L` em modo local e detectou `web` (Next.js) e `omr` (FastAPI), iniciando ambos sem linkar um projeto. A CLI avisou que `-L` está obsoleto e recomenda `--local`; como não havia projeto vinculado, variáveis do painel não foram buscadas. Esse teste valida a leitura inicial da configuração, **não** o deploy, o binding em produção ou o fluxo autenticado. As dependências instaladas no `site-packages` local ocupam cerca de **252 MiB**, mas isso não equivale ao bundle da Function. Ainda faltam medição do bundle final, cold start, memória/tempo com concorrência e limites reais do plano. O limite publicado de [requisição/resposta de Function é 4,5 MB](https://vercel.com/docs/functions/limitations); a aplicação mantém limites menores. Confirme duração e memória configuradas no plano antes de operar. O PDF.js do navegador continua rendendo uma página por vez e enviando as metades separadamente, com concorrência de dois; não há fila externa. O build local não aplica migrations.

## Ensaio físico obrigatório antes do uso

1. Imprima PDFs oficiais em A4 comum, dois cartões por folha; fotografe metades inteiras e uma folha inteira, com os quatro marcadores visíveis.
2. Faça um gabarito conhecido com 10 e 40 questões, incluindo branco, dupla/tripla, caneta preta e azul, traços incompletos e preenchimento na borda.
3. Repita com pelo menos dois celulares, luz natural e artificial, inclinação leve, sombra e resolução variada. Registre para cada cartão as respostas esperadas, as detectadas, revisões e rejeições.
4. Compare todas as questões e separe erro silencioso de revisão/rejeição. Ajuste limiares somente a partir dos erros observados; rode a suíte e o benchmark novamente.
5. No banco alvo, confira `npm run db:status` e confirme se é o ambiente pretendido. No Neon configurado agora as três migrations já estão em dia. Teste login de professor/coordenação, upload, prévia, revisão, confirmação idempotente, auditoria e ranking contra esse banco; qualquer nova migration exige revisão e autorização operacional.

Até esse ensaio, não há taxa de acerto real declarada e o processamento não deve ser tratado como validado para atribuir notas finais sem conferência humana.
