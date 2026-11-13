# Tasks

## 1. Levantamento que decide o desenho (sem alterar código)

- [x] 1.1 Para cada `source` de `thinkzap-inbound` (`z-api`, `hubmessage`, `hubmessage-status`, `bitrix`, `bitrix-bot`), anotar em `design.md` (seção Decisões) em que campo do `body` estão o portal e a instância, ou que não há. Verificar lendo os processors e conferindo que cada origem tem uma linha na anotação.
- [x] 1.2 Para cada processor de entrada, decidir se a reentrega é idempotente (`uq_msg_instance_provider`, `uq_msg_instance_bitrix`, efeito no CRM) e listar as origens reprocessáveis em `design.md`. Verificar que cada origem tem a decisão e o motivo; origem sem prova fica fora da lista.
- [x] 1.3 Conferir se algo referencia `core_thinkerszap_widget_outbox` por FK ou cascata, e como `[id]` de `/admin/clientes/<id>` se relaciona com `domainId`. Verificar com `grep` no `schema.prisma` e na rota do cliente, registrando o resultado em `design.md` (Open Questions → Decisões).
- [x] 1.4 Confirmar o `removeOnFail` efetivo da fila `thinkzap-widget-outbound` e, se for o padrão (guarda os falhos para sempre no Redis), definir `removeOnFail` de 7 dias nessa fila, como a de entrada. Verificar lendo `thinkzap-widget-outbound.queue.ts` e o teste da fila.

## 2. Banco e configuração

- [x] 2.1 Adicionar ao `schema.prisma` os modelos `ThinkzapInboundFailure` e `ThinkzapDeliveryAttempt` (campos e índices de `design.md`, decisão 1) e criar a migration nova com `npx prisma migrate dev --name falhas-recebimento-e-tentativas`, sem tocar nas existentes. Verificar com `yarn prisma:generate`, `yarn check-types` e o agente `guardiao-migrations` aprovando.
- [x] 2.2 Adicionar `FAILURE_RETENTION_DAYS` (inteiro ≥ 1, padrão 7, inválido recusa a subida) e `FAILURE_PURGE_ENABLED` (padrão `false`) em `config/env.ts` e `api/.env.example`, com comentário, e documentar no `DEPLOY.md` (as flags vêm do `.env` do servidor; os compose usam `env_file` e não são alterados) que o expurgo se liga em um ambiente só quando staging e produção dividem o banco. Verificar com teste de `env` para padrão, valor inválido e `0`, e com o agente `auditor-ambientes`.

## 3. Registro de tentativas e falhas (API)

- [x] 3.1 Criar a porta `DeliveryAttemptRecorder` (domínio) e o repositório Prisma de `ThinkzapDeliveryAttempt` com `record` (que nunca lança, loga o erro) e `listByRef`, numerando a tentativa por `max(attempt) + 1`. Verificar com testes do repositório: numeração, falha de banco engolida e continuação da numeração após reprocesso.
- [x] 3.2 Registrar a tentativa que falha em `dispatch-widget-outbox-message.ts` (falha do provider, indeterminada, limite diário, template/botão incompleto, linha indisponível), sem registrar sucesso nem adiamento por `DelayedError`. Verificar com os testes `dispatch-widget-outbox-message(.cadence).test.ts` estendidos para os cenários da spec `log-tentativas-falha` e com os existentes passando.
- [x] 3.3 Criar o repositório de `ThinkzapInboundFailure` e a função de captura no `thinkzap-inbound.worker.ts`: registrar a tentativa a cada falha e a linha de falha só na tentativa final (`attemptsMade >= opts.attempts` ou `UnrecoverableError`), com origem/tipo/`traceKey`/portal (extração da tarefa 1.1)/código de erro/`payload`, tudo em `try/catch` que não relança. Verificar com testes do worker: falha que se recupera não grava, tentativas esgotadas gravam, erro de banco não derruba o worker.
- [x] 3.4 Adicionar `thinkzap.inbound.event_failed` ao `modules/thinkzap/errors/catalog.ts`, logá-lo na captura e criar o runbook em `mcp/kb/runbooks/hubcore/thinkzap/inbound/`. Verificar com o teste de cruzamento catálogo × runbooks passando e `yarn build` do `mcp`.

## 4. Listagem, detalhe e reprocesso (API portal)

- [x] 4.1 Adicionar o filtro exato `domainId` à lista de saída existente e às novas, e passar o teto e o padrão do período a vir de `FAILURE_RETENTION_DAYS`. Verificar com testes do controller (`outbox-failures-controller.test.ts`) para `domainId`, `acme` × `acme-filial` e período acima do prazo recusado.
- [x] 4.2 Incluir as tentativas (`listByRef`) no detalhe de falha de saída (`GET /thinkzap/outbox-failures/:id`), com a indicação de "sem tentativas registradas" para itens antigos. Verificar com teste do caso de uso `GetOutboxFailure`.
- [x] 4.3 Criar os casos de uso e controllers de recebimento: lista (filtros portal, origem, situação, período; paginação), detalhe (campos seguros do `payload`, tentativas) e reprocesso com `updateMany` atômico, `jobId` novo, compensação se o `add` falhar e recusa para origem fora de `REPROCESSABLE_INBOUND_SOURCES`. Verificar com testes dos casos de uso e controllers: reprocesso ok, origem não reprocessável, conflito de duas pessoas, falha ao enfileirar e nova falha ligada à anterior.
- [x] 4.4 Expor as rotas em `modules/portal/routes.ts` atrás de `portalAuthMiddleware` (lista, detalhe e reprocesso de recebimento, com a rota estática antes de `/:id`) e ligar nas fábricas e no `composition-root.ts`. Verificar com teste de rota sem sessão (401) e com sessão.

## 5. Expurgo por retenção

- [x] 5.1 Implementar o job `failure-retention.job.ts` em `shared/infra/scheduler/` (padrão do `stripe-sync.job.ts`: `node-cron`, lock em Redis, `enabled`, dependências injetáveis), com expurgo em lotes de falhas de recebimento, tentativas e outbox `FAILED`/`UNKNOWN` vencidos, log das quantidades e teto de lotes por rodada; registrar no `app.ts`. Verificar com testes: itens vencidos apagados, outbox entregue preservada, vários lotes, duas instâncias (lock), falha no meio retomada na rodada seguinte e job desligado não agenda.
- [ ] 5.2 Verificar o expurgo contra o banco real de desenvolvimento com `FAILURE_RETENTION_DAYS=1` num conjunto semeado: conferir que só o esperado é apagado e que nada de outro status some. Verificar rodando o job uma vez e comparando as contagens antes e depois.
  - **Pendente:** exige um MariaDB de desenvolvimento acessível; `localhost:3306` não respondia neste ambiente. O job e as consultas estão cobertos por testes com Prisma dublado.

## 6. Front

- [x] 6.1 Estender `front/lib/outbox-failures.ts` com os tipos e chamadas de recebimento, tentativas e `domainId`. Verificar com `front/lib/outbox-failures.test.ts` estendido.
- [ ] 6.2 Adicionar a aba "Recebimento" em `admin-outbox-failures-page.tsx` (filtros, lista paginada, situação, "não reprocessável"), a lista de tentativas nos dois detalhes e o aviso do prazo de guarda, extraindo o reprocesso com a confirmação de duplicidade para um componente compartilhado. Verificar abrindo a tela em `yarn dev` (envio inalterado, recebimento com dados semeados) e com `yarn check-types` e `yarn lint`.
  - **Pendente:** implementado, com `check-types` e `lint` limpos, mas a verificação visual no navegador (envio inalterado, recebimento com dados semeados) exige API e banco rodando, que não havia neste ambiente.
- [ ] 6.3 Criar a seção "Falhas de mensagens" na página do cliente (`admin-client-detail-page.tsx`), filtrada por `domainId`, com envio e recebimento, estado de erro com "tentar de novo", reprocesso e link para a tela geral filtrada. Verificar abrindo a página de um cliente com e sem falhas e derrubando a API para ver o estado de erro sem quebrar o restante.
  - **Pendente:** implementado, com `check-types` e `lint` limpos, mas a verificação visual (cliente com e sem falhas, API derrubada) exige API e banco rodando, que não havia neste ambiente.
- [x] 6.4 Traduzir os textos novos em `front/messages/{pt,en,es}/admin`. Verificar com o teste de paridade de chaves de i18n, se existir, ou conferindo as três pastas com `grep` das chaves novas.

## 7. Fechamento

- [x] 7.1 Rodar `yarn check-types`, `yarn lint` e `yarn test` em `api`, e `check-types`, `lint` e `test` em `front` (mudança cruza pacotes), e `yarn build` em `mcp`. Verificar com tudo verde, ou citar falha preexistente não relacionada no commit.
- [x] 7.2 Revisar a branch com os agentes `revisor-codigo`, `guardiao-migrations` e `auditor-ambientes` e tratar o que apontarem. Verificar com os relatórios sem pendência bloqueante.
- [ ] 7.3 Pendências pós-deploy, a registrar no commit: ligar `FAILURE_PURGE_ENABLED` em staging, conferir os logs de expurgo e a tela, depois ligar em produção; arquivar a change com `/opsx:archive`; e, se `resiliencia-envio-fila-linha` for arquivada antes, revisar se os requisitos viram deltas dela.
