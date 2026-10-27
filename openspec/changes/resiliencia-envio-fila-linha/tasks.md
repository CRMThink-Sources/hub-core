# Tasks

## 1. Falha temporária na consulta da linha é retentada

- [x] 1.1 Fazer `resolveLineTarget` (`api/src/workers/thinkzap-widget-send.processor.ts`) devolver `found`, `not-found` ou `unavailable`:
  - `LineNotFoundError` e provider `NONE` dão `not-found`;
  - qualquer outra exceção dá `unavailable` com o erro.

  Verificar com testes unitários dos três casos. Usar como erro do caso `unavailable` o `Failed to list CRM items`.
- [x] 1.2 No `processWidgetSendJob`:
  - `not-found` mantém o fluxo atual (`markFailed` com "Linha não encontrada na instalação" + aviso);
  - `unavailable` sem ser a última tentativa relança o erro, sem `claim` e com a row em `PENDING`;
  - `unavailable` com `isLastAttempt` faz `markFailed('Falha temporária ao consultar a linha: <erro resumido>')` + `notifyOutcomeFor(row, 'failed')`.

  Registrar no job log o caminho seguido. Verificar com testes do processor para os cenários "Bitrix instável na primeira tentativa", "Bitrix volta antes da última tentativa", "Bitrix fora do ar durante todas as tentativas" e "Linha removida da instalação".
- [x] 1.3 Mudar `enqueueThinkzapWidgetOutboundJob` (`api/src/queue/thinkzap-widget-outbound.queue.ts`) para `attempts: 4` e `backoff: { type: 'exponential', delay: 10_000 }`. Verificar com teste da fila conferindo as opções e com os testes existentes de `widget-send-outcome` passando, já que os adiamentos continuam sem gastar tentativa.
- [x] 1.4 Adicionar o código `thinkzap.outbox.line_lookup_unavailable` em `api/src/modules/thinkzap/errors/catalog.ts`, logado no caminho `unavailable`, e o guia de resolução em `mcp/kb/runbooks/hubcore/thinkzap/outbox/`. Verificar com o teste de cruzamento catálogo × runbooks.

## 2. Cópia de reserva do cache do contexto da aplicação

- [x] 2.1 Adicionar em `api/src/modules/application/infra/cache/keys.ts` o namespace das chaves de reserva (prefixo próprio, mesma versão da família e ambiente do gateway em plano e assinatura). Verificar com teste em `keys.test.ts` provando que os padrões de `SCAN` de invalidação **não** casam com as chaves de reserva.
- [x] 2.2 Criar o helper `stale-if-error.ts`:
  - hit fresco devolve direto;
  - num miss, carrega da fonte e grava o cache fresco (5 min) e a reserva (24 h);
  - se a fonte falhar, lê a reserva validada pelo schema e faz `warn`;
  - sem reserva, relança o erro original;
  - falha do Redis nunca derruba a leitura.

  Verificar com testes unitários de cada ramo.
- [x] 2.3 Aplicar o helper nas leituras de `CachedSubscriptionItemRepository`, `CachedSubscriptionRepository`, `CachedPlanRepository` e `CachedProductRepository`, e gravar a reserva também nos caminhos de escrita (`refresh`). Verificar com os testes existentes dos quatro repositórios passando, mais um teste por repositório para "Bitrix falha com cópia de reserva disponível" e "Cópia de reserva vencida".
- [x] 2.4 Teste do processor com o contexto montado sobre repositórios cacheados: o Bitrix falha, a reserva existe e a mensagem é enviada na mesma tentativa. Verificar com o cenário "Bitrix falha com cópia de reserva disponível" da spec.

## 3. Reprocessamento no backend

- [x] 3.1 Criar a migration aditiva em `core_thinkerszap_widget_outbox` com `reprocess_count` (default 0), `last_reprocessed_at` e `last_reprocessed_by`, e atualizar `schema.prisma`. Verificar com `prisma migrate dev` aplicando sem erro e `prisma generate` sem diferenças inesperadas.
- [x] 3.2 Adicionar ao repositório do outbox:
  - `listFailures(filters)`, com paginação, join com `Domain` e texto truncado;
  - `findFailureDetail(id)`;
  - `requeueForReprocess(id, { portalUserId, allowUnknown })`, com `updateMany` condicional, mantendo `lastError`, limpando `cadenceWaitUntil` e `timelineNotifiedAt` e incrementando o contador.

  Verificar com os testes do repositório:
  - filtros por status, domínio, origem e período;
  - conflito em row `SENT`, `PENDING` ou com `providerMessageId`;
  - `UNKNOWN` recusado sem `allowUnknown`.
- [x] 3.3 Criar os casos de uso `ListOutboxFailures`, `GetOutboxFailure` e `ReprocessOutboxFailures`. O reprocessamento cobre um ou vários (até 50), chama `requeueForReprocess` e depois `BullMqWidgetSendQueue.ensureScheduled`, e devolve o resultado por id. O detalhe resolve o e-mail do usuário do portal. Verificar com testes dos cenários "Reprocessar o 'Buen día' que falhou", "Reprocessar duas vezes ao mesmo tempo", "Mensagem já enviada", "UNKNOWN sem confirmação", "UNKNOWN com confirmação" e "Lote com uma mensagem já enviada".
- [x] 3.4 Criar os controllers e as rotas em `api/src/modules/portal/routes.ts`, atrás de `portalAuthMiddleware`:
  - `GET /portal/thinkzap/outbox-failures`;
  - `GET /portal/thinkzap/outbox-failures/:id`;
  - `POST /portal/thinkzap/outbox-failures/:id/reprocess`;
  - `POST /portal/thinkzap/outbox-failures/reprocess`.

  A validação usa zod: período de no máximo 90 dias, padrão de 7 dias, `limit` até 100 e lote de 1 a 50. Verificar com os testes dos controllers: 401 sem sessão, 400 em período inválido, 202, 409 e 422 no reprocessamento individual, e 200 com resultado por id no lote.

## 4. Tela "Falhas de envio" no portal admin

- [x] 4.1 Criar o cliente `front/lib/outbox-failures.ts`, com listagem, detalhe e reprocessamento individual e em lote via `axiosPortal`, e os tipos. Verificar com `tsc` sem erros.
- [x] 4.2 Criar a página `front/app/(admin)/admin/falhas-envio/page.tsx` e o componente `front/components/layouts/admin/admin-outbox-failures-page.tsx`, no padrão de `admin-jobs-page.tsx`:
  - filtros de portal, status, origem e período;
  - tabela paginada com as colunas da spec e seleção múltipla;
  - estados de carregando, vazio e erro com "tentar de novo".

  Verificar no navegador que a lista carrega com o filtro padrão de 7 dias.
- [x] 4.3 Criar o detalhe (painel ou modal) com os campos da spec e o histórico de reprocessamento, e as ações "Reprocessar" (individual e em lote). `UNKNOWN` exige um diálogo de confirmação de duplicidade, sem `window.confirm`. Mostrar o resultado por id no lote via toast ou resumo. Verificar no navegador reprocessando uma falha de staging e vendo o contador subir e o status mudar.
- [x] 4.4 Adicionar o item `navOutboxFailures` no `admin-shell.tsx` e as traduções do namespace `admin/outbox-failures` em `front/messages/{pt,en,es}/admin`. Verificar com os testes de i18n do front (chaves iguais nos três idiomas) e trocando o idioma no navegador.

## 5. Verificação integrada

- [ ] 5.1 Rodar `lint`, `tsc` e os testes da API e do front. Verificar com todos passando.
- [ ] 5.2 Em staging, simular o Bitrix interno indisponível (webhook inválido no env do worker) com o cache fresco vencido:
  - com reserva, a mensagem sai;
  - sem reserva, a mensagem retenta e vira `FAILED` com "Falha temporária ao consultar a linha", aparece em "Falhas de envio" e, depois de restaurar o webhook, é reprocessada pela tela e fica `SENT`.

  Verificar pelo status da row e pelo job log.
