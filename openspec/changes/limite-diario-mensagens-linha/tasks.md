# Tasks

## 1. Domínio: dia, configuração e cálculo de uso

- [x] 1.1 Extrair de `domain/connector-trial.ts` um helper exportado `dayKeyOf(instant): 'YYYY-MM-DD'` no fuso `BILLING_TIME_ZONE`, sobre o mesmo `billingDayOf`. Verificar com teste:
  - `2026-10-16T02:30Z` dá `2026-10-15`;
  - `2026-10-16T03:30Z` dá `2026-10-16`;
  - os testes existentes de `connector-trial` continuam passando.
- [x] 1.2 Adicionar `dailyLimitEnabled` (default `false`) e `dailyLimit` (`number | null`) em `domain/value-objects/connector-settings.ts`, `connector-settings.schema.ts` e no schema do cache do item (`cached-subscription-item.repository.ts`). Verificar com teste do schema:
  - settings antigos sem os campos leem `false`/`null`;
  - valor estranho num campo cai no default só daquele campo;
  - o merge preserva os demais toggles.
- [x] 1.3 Criar a função pura de uso do dia (decisão 5 do design). Ela recebe `enabled`, `limit`, `sent` e `extra` e devolve `effectiveLimit`, `remainingPercent` e `reached`. Verificar com testes dos cenários de "Exibição do uso do dia":
  - 225/300 dá 25%;
  - 300/300 dá 0% e `reached`;
  - 350/400 dá 13%;
  - desativado dá `remainingPercent: null`.
- [x] 1.4 Adicionar os códigos `thinkzap.line.daily_limit_*` em `errors/catalog.ts` (decisão 7) e os guias em `mcp/kb/runbooks/hubcore/thinkzap/line/`. Verificar com o teste de cruzamento catálogo × runbooks.

## 2. Cota diária em Redis

- [x] 2.1 Criar a porta `DailySendQuota` e o adapter Redis, com as chaves `thinkzap:daily-sent:{lineKey}:{dia}` e `thinkzap:daily-extra:{lineKey}:{dia}` (`lineKey` = `zApiInstanceId`) e TTL de 48h. O adapter tem estas operações:
  - `reserve`, com script Lua de checar e somar numa operação só, e `release` da reserva, que faz DECR sem passar de zero;
  - `wouldRefuse`, leitura sem reservar;
  - `addExtra`, que faz INCRBY;
  - `usage`.

  Verificar com testes do adapter (Redis fake que executa os scripts):
  - com o limite desativado, a reserva sempre soma;
  - com o limite ativado, recusa em `sent >= limit + extra`;
  - os extras ampliam o limite;
  - a chave muda com o dia;
  - `release` não fica negativo.
- [x] 2.2 Verificar a atomicidade com um teste de duas reservas concorrentes na última vaga: exatamente uma é aceita (cenário "Envios simultâneos na última vaga").
- [x] 2.3 Criar o helper `sendWithinDailyQuota(quota, policy, send)` (decisão 3 do design). Com `policy` nula, só chama `send`. Verificar com testes:
  - sucesso mantém a reserva;
  - falha respondida (`classifyProviderSendFailure`) libera a reserva;
  - falha `indeterminate` mantém a reserva;
  - recusa lança `thinkzap.line.daily_limit_reached` sem chamar `send`;
  - `policy` nula não toca no Redis.
- [x] 2.4 Criar `dailyLimitPolicyOf`, que monta a `policy` a partir da linha e devolve `null` quando o provider não é `ZAPI`, e a factory `main/make-daily-send-quota.ts`. Verificar com teste unitário do mapeamento de provider.

## 3. API de configuração, uso e liberação temporária

- [x] 3.1 Aceitar `dailyLimitEnabled` e `dailyLimit` no zod estrito de `update-line-settings.controller.ts`. Em `application/update-line-settings.ts`, antes de qualquer escrita, recusar com `daily_limit_invalid`:
  - linha que não é Z-API;
  - limite ativado sem inteiro maior que zero.

  Verificar com testes do caso de uso e do controller:
  - ativar com 300 grava;
  - 0 é recusado e nada é gravado, nem o nome;
  - linha oficial é recusada.
- [x] 3.2 Incluir o bloco `dailyLimit` (`enabled`, `limit`, `sentToday`, `extraToday`, `effectiveLimit`, `remainingPercent`, `reached`) na resposta de `GET /lines/:itemId/settings`, via `get-line-settings.ts` e `line-settings.mapper.ts`. O bloco é omitido na linha oficial e vem `null` quando o contador falha. Verificar com teste do mapper e do caso de uso.
- [x] 3.3 Criar `POST /api/thinkzap/lines/:itemId/daily-limit/extra`, com corpo `{ amount }` (inteiro maior que zero, zod) e `requireThinkzapPermission('connectors', 'update')`. O endpoint:
  - recusa linha oficial;
  - recusa limite gravado desativado;
  - recusa linha bloqueada;
  - devolve o bloco `dailyLimit` atualizado.

  Verificar com testes do controller e do caso de uso dos cenários "Liberar extras após atingir o limite", "Liberações somam" e "Liberação com limite desativado".
- [x] 3.4 Confirmar que, depois do PATCH de settings, a `policy` lida no caminho de envio reflete o novo limite. Documentado no design ("Fonte da `policy` no caminho de envio").

## 4. Aplicar a cota nos caminhos de envio da linha Z-API

- [x] 4.1 Resposta do operador, em `workers/bitrix-received-message.processor.ts`: envolver `sender.send` e o envio de botões com `sendWithinDailyQuota`, chave `context.instance.instanceId`. Na recusa:
  - avisar o operador com `notifyOperatorDailyLimitReached`, no molde de `application/notify-operator-window-closed.ts`;
  - registrar no log do job;
  - retornar sem relançar e sem `setDelivered`.

  Verificar com teste do processor: o provider não é chamado, o aviso é enviado, não há rethrow, a recusa respondida da Z-API devolve a vaga e a linha oficial não toca a cota.
- [x] 4.2 Outbox, em `application/dispatch-widget-outbox-message.ts`: envolver o `callProvider` com `sendWithinDailyQuota`, usando a `policy` vinda de `DispatchLineTarget.settings`; o worker (`workers/thinkzap-widget-send.processor.ts`) injeta a cota. A recusa é terminal em qualquer tentativa:
  - `markFailed`;
  - `notifyOutcome('daily-limit')`, com texto próprio em `notify-widget-send-outcome.ts`;
  - `reportCampaignStatus('failed')`.

  Verificar com testes do dispatcher: "Limite atingido com mensagem já na fila", recusa sem PENDING e Campanha de SMS com status `failed`.
- [x] 4.3 Pré-checagem no enfileiramento, em `enqueue-widget-message.use-case.ts` (texto do widget e Campanha de SMS da linha não oficial) e `enqueue-interactive-button-send.service.ts`, com `assertDailyLimitNotReached`. Mapear para HTTP 429 com o código `daily-limit-reached` em `presentation/helpers/handle-widget-send-error.ts`. Verificar com testes:
  - "Envio pelo widget com o limite atingido": nada é enfileirado;
  - o controller de Campanha de SMS reporta `failed` quando o enfileiramento recusa;
  - linha oficial não consulta a cota.
- [x] 4.4 Bot, em `workers/bitrix-bot-event.processor.ts` e `infra/adapters/hybrid-bot-session.adapter.ts`: montar a `policy` da linha Z-API (`findLineItemByInstanceId`) e envolver o `contato.send`. Na recusa, registrar no log do job, não fazer o eco e não relançar. Verificar com teste do adapter: o contato não recebe, o eco não é chamado e não há exceção.
- [x] 4.5 Contagem com o limite desativado: verificar com teste do outbox que um envio bem-sucedido incrementa o contador do dia com `dailyLimitEnabled = false`, e que um envio pela linha oficial não toca o Redis.
- [x] 4.6 Envio com anexo pelo widget, em `application/send-widget-message.use-case.ts`: pré-checagem antes da primeira parte e reserva por parte. Se o limite acaba no meio, parar, registrar o que saiu e avisar na timeline quantos anexos não foram enviados. Verificar com testes dos cenários "Texto com anexos conta cada parte" e "Limite acaba no meio do envio com anexos", e da recusa inteira com o limite já atingido.
- [x] 4.7 Robô "Enviar mensagem", em `presentation/controllers/bitrix-robot-webhook-handler.controller.ts`: reservar por destinatário, listar os recusados na timeline e devolver `refusedByDailyLimit`. Verificar com teste do cenário "Robô \"Enviar mensagem\" além do limite".

## 5. Front: card Limite diário na aba Ajustes

- [x] 5.1 Em `front/app/hooks/use-line-api.ts`, adicionar os tipos de `dailyLimitEnabled`, `dailyLimit` e do bloco `dailyLimit` da resposta, e o método `releaseDailyLimitExtra(amount)`. Verificar com typecheck e lint do front sem erros.
- [x] 5.2 Em `ajustes-alteracoes.ts`, rastrear o toggle e o valor numérico do limite, com validação de inteiro maior que zero quando ativado e contagem de pendências. Verificar com os testes do módulo nos cenários "Limite diário conta como alteração" (2 alterações) e "Limite inválido impede salvar".
- [ ] 5.3 Criar o card "Limite diário" (`limite-diario-card.tsx`) depois de Comportamento em `ajustes-tab.tsx`, só para linha Z-API (a página passa `provider="ZAPI"`), com:
  - toggle e input;
  - barra de uso com enviadas/efetivo e percentual restante;
  - estado de limite atingido;
  - texto de "sem limite ativo" quando desativado;
  - estados desabilitados com a linha bloqueada.

  Verificar no app: o card aparece numa linha Web, não aparece numa linha Business, e salvar pela barra grava os campos.

  Estado: implementado; typecheck e lint ok. Falta a verificação no app.
- [ ] 5.4 Criar o diálogo "Liberar limite temporário", com a quantidade, o aviso "vale só para hoje" e a confirmação. A ação fica habilitada só com o limite gravado como ativo e atualiza o uso exibido sem gerar pendência na barra. Verificar no app nos cenários "Liberar limite temporário" e "Liberação indisponível com limite não gravado".

  Estado: implementado (`LiberarLimiteDialog` em `limite-diario-card.tsx`). Falta a verificação no app.
- [x] 5.5 Adicionar as chaves de i18n em `front/messages/{pt,en,es}/thinkzap/configuracoes/ajustes.json`. Verificar que as três línguas têm as mesmas chaves e que nenhuma chave usada pelo card falta.

## 6. Verificação integrada

- [ ] 6.1 Em staging, numa linha Web (Z-API) com limite 3:
  1. enviar 3 mensagens, misturando operador, widget e robô;
  2. confirmar que a 4ª é recusada em cada origem com o aviso esperado (inclusive envio com anexo e robô "Enviar mensagem");
  3. liberar 2 extras;
  4. confirmar que mais 2 passam e a seguinte é recusada;
  5. confirmar que a tela mostra enviadas, efetivo e percentual corretos em cada passo;
  6. confirmar que uma linha Business não mostra o card e não é limitada.
- [ ] 6.2 Rodar `yarn test` e lint no `api/` e no `front/` e verificar que tudo passa. Rodar `openspec validate limite-diario-mensagens-linha --strict` e verificar que passa.

  Estado: api 3524/3524 testes e lint ok; front lint e typecheck ok; `openspec validate --strict` ok. No front, 984/985 testes passam: a falha é `bots/issue-text.test.ts`, que já falhava sem esta change.

## 7. Idioma dos avisos

- [x] 7.1 Gravar o idioma por instalação em `core_apps.locale` (migration `20261016120000_add_app_locale`) com o endpoint `PUT /api/thinkzap/locale`, chamado pelo menu do ThinkZap na troca de idioma. Verificar com teste do controller: grava pela instalação do JWT, recusa idioma inválido e responde 404 para instalação inexistente.
- [x] 7.2 Textos dos avisos em pt, en e es (`domain/daily-limit-notices.ts`), lidos por `PrismaInstallationLocaleRepository`, que cai em português se falhar, e aplicados no chat do canal aberto, na timeline do outbox, no envio com anexo e no robô "Enviar mensagem". Verificar com testes de cada caminho em inglês ou espanhol e do padrão em português.
- [ ] 7.3 Em staging, trocar o idioma do app para inglês, atingir o limite e confirmar o aviso em inglês no chat e na timeline.
