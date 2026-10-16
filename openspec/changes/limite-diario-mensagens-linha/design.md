# Design

## Context

O motivo está em proposal.md, seção Why. Os requisitos estão em `specs/thinkzap/limite-diario-mensagens/spec.md` e no delta de `specs/thinkzap/configuracao-linha/spec.md`. O que existe hoje e molda a solução:

- **A linha é um item da SPA 1146.** A configuração por linha vive em `ConnectorSettings`, no campo `ufCrm93Settings`:
  - o schema zod está em `connector-settings.schema.ts`;
  - o PATCH passa por `update-line-settings.controller.ts`, que usa um zod estrito, e por `update-line-settings.ts`;
  - a leitura passa pelos repositórios de contexto, que têm cache (`CachedSubscriptionItemRepository`, com schema próprio para os settings).

  O `Instance.settings` do banco é legado e não deve ser lido.
- **"Não oficial" é o provider `ZAPI`** ("Web" na interface). O `zApiInstanceId` chega a todos os caminhos de envio:
  - no `DispatchLineTarget` do outbox (`instanceId`);
  - no contexto do webhook do canal aberto e do bot (`context.instance.instanceId`);
  - no item resolvido pelo widget e pelo robô (`line.zApiInstanceId`).
- **Caminhos de envio de uma linha Z-API.**
  1. `workers/bitrix-received-message.processor.ts`: resposta do operador e envio de botões pelo canal aberto. Resolve `line` com `entitlement` e `settings` antes de enviar e já tem o padrão de aviso ao operador (`notifyOperatorWindowClosed`).
  2. `application/dispatch-widget-outbox-message.ts`, no `callProvider`: texto e botões do widget, robô de botões e Campanha de SMS. `handleSendFailure` separa a falha indeterminada da falha respondida e cuida do terminal (`markFailed`, `notifyOutcome`, `reportCampaignStatus`).
  3. `workers/bitrix-bot-event.processor.ts` com `HybridBotSessionAdapter.say`: fala do bot, sem persistência em `ThinkzapMessage`.
  4. `application/send-widget-message.use-case.ts`: envio com anexo pelo widget. É síncrono e chama `ZApiClient` direto, uma chamada por parte.
  5. `presentation/controllers/bitrix-robot-webhook-handler.controller.ts`: robô "Enviar mensagem". Chama `ZApiClient.sendMessage` direto, em laço por destinatário, sem persistir.
- **Contagem.** `ThinkzapMessage` não cobre todos os caminhos: o bot e o robô não gravam, e a gravação acontece depois do envio. Por isso ela não serve como fonte atômica da contagem.
- **Infraestrutura disponível.**
  - Redis (ioredis), com padrão de chave e TTL em `infra/queue/destination-send-lock.ts`.
  - O fuso `BILLING_TIME_ZONE = 'America/Sao_Paulo'` e o cálculo de dia via `Intl` em `domain/connector-trial.ts`.

## Goals / Non-Goals

**Goals:**
- Uma regra de cota reutilizada por todos os caminhos de envio da linha não oficial. A decisão "pode enviar?" e a contagem acontecem num passo atômico.
- Nenhum envio concorrente estoura o limite efetivo.
- Recusa por limite com custo zero na Z-API e sem retentativa inútil.
- Nenhuma migration e nenhuma escrita extra no Bitrix no caminho quente de envio.

**Non-Goals:**
- Aplicar o limite na linha oficial (HubMessage). A `policy` dela é `null`; estender seria trocar o filtro de provider em `dailyLimitPolicyOf` e escolher a chave (canal).
- Histórico de uso por dia além do dia corrente.
- Reconciliar a contagem com `ThinkzapMessage` se o Redis for perdido.

## Decisions

### 1. Configuração no `ConnectorSettings` do item da SPA
- **Decisão:**
  - Dois campos novos: `dailyLimitEnabled: boolean`, com default `false`, e `dailyLimit: number | null`.
  - O schema de parse e merge aplica o default para linhas antigas. Valor estranho num dos campos cai no default só daquele campo (`.catch`), sem zerar os outros toggles.
  - O schema do cache do item passa a exigir os dois campos; entrada antiga vira miss.
  - O controller de PATCH aceita os dois campos.
  - O caso de uso valida, antes de qualquer escrita (inclusive o nome), e recusa com `thinkzap.line.daily_limit_invalid`:
    - linha Z-API;
    - inteiro maior que zero quando o limite fica ligado (avaliado sobre o resultado do merge).
- **Por quê:** é onde já vivem os ajustes da linha, com leitura em cache e a mesma permissão (`connectors:update`).
- **Alternativa descartada:** tabela nova no MySQL. Exigiria migration e uma segunda fonte de configuração da linha.

### 2. Contador e extras do dia em Redis, chaveados por instância e dia
- **Decisão:**
  - `thinkzap:daily-sent:{zApiInstanceId}:{YYYY-MM-DD}` guarda o contador.
  - `thinkzap:daily-extra:{zApiInstanceId}:{YYYY-MM-DD}` guarda a soma dos extras liberados.
  - As duas chaves têm TTL de 48h.
  - O dia vem de `dayKeyOf(instant)` no fuso `BILLING_TIME_ZONE`, exportado de `connector-trial.ts` sobre o mesmo `billingDayOf`, para que dia de cobrança e dia de cota não divirjam.
  - Na `policy` e na porta, a chave se chama `lineKey`.
- **Por quê:**
  - Data na chave: a virada do dia é automática e não precisa de cron de reset.
  - Cobre o bot e o robô, que não persistem mensagem.
  - O `zApiInstanceId` está em todos os caminhos sem precisar resolver o item.
- **Alternativas descartadas:**
  - Contar em `ThinkzapMessage` (`countByInstanceAndSource`): não é atômico, porque grava depois do envio, e não cobre bot nem robô.
  - Guardar os extras no settings da SPA: seria uma escrita no Bitrix com invalidação de cache para um dado que expira no mesmo dia.

### 3. Reserva atômica antes do envio e devolução na falha respondida
- **Decisão:** a porta `DailySendQuota` tem as operações `reserve`, `wouldRefuse`, `addExtra` e `usage`.
  - `reserve(policy, now)` roda um script Lua no Redis:
    1. lê o contador e os extras;
    2. se `policy.enabled` e `contador >= limite + extras`, devolve `refused`;
    3. senão faz INCR e devolve uma `reservation`.

    Com o limite desligado, o script só faz INCR, para que a contagem exista antes da ativação.
  - `reservation.release()` faz DECR na chave do dia da reserva, protegido para não ficar abaixo de zero, e só uma vez.

  O helper `sendWithinDailyQuota(quota, policy, send)` concentra o ciclo:
  - reserva antes de enviar;
  - mantém a reserva no sucesso e na falha `indeterminate`, conforme `classifyProviderSendFailure`;
  - libera na falha respondida;
  - na recusa, lança `thinkzap.line.daily_limit_reached`, sem chamar a Z-API.

  `dailyLimitPolicyOf` devolve `null` para linha que não é Z-API, e o helper então só chama o envio.
- **Por quê:** "checar e depois contar" em dois passos deixa duas mensagens passarem na última vaga, o que fere o requisito de envio simultâneo. Reservar e devolver dá exatidão sem lock por linha.
- **Alternativa descartada:** decorator dentro dos resolvers de sender. Os resolvers recebem só `provider` e `target`, sem `settings`, e dois caminhos nem passam por eles (anexo do widget e robô "Enviar mensagem"). O helper fica no ponto onde a `policy` já está disponível.

### 4. Tratamento da recusa em cada origem
- **Decisão:**
  - **Operador** (`bitrix-received-message.processor.ts`): captura `daily_limit_reached` no texto e nos botões e avisa o operador no chat com `notifyOperatorDailyLimitReached`. O aviso vai como mensagem de sistema por `postOpenChannelSystemNotice`: primeiro pelo bot e, se o Bitrix recusar, pelo usuário do app (`im.message.add`). Em staging (`crmthinkers`, chat 9500), o `imbot.message.add` direto foi recusado com `CANCELED`, porque o bot do conector não participa da sessão do canal aberto. O desfecho do aviso vai para o log do job. Retorna sem relançar: o job termina sem retentativa e sem `setDelivered`.
  - **Outbox** (`dispatch-widget-outbox-message.ts`): a recusa é terminal em qualquer tentativa. Faz `markFailed`, depois `notifyOutcome('daily-limit')`, com texto próprio na timeline, e depois `reportCampaignStatus('failed')`. Não volta para PENDING.
  - **Enfileiramento** (`enqueue-widget-message`, `enqueue-interactive-button-send`): pré-checagem de leitura (`assertDailyLimitNotReached`, via `wouldRefuse`), sem reservar. Recusa com `thinkzap.line.daily_limit_reached`, que `handle-widget-send-error.ts` mapeia para HTTP 429 com o código `daily-limit-reached`. A Campanha de SMS já reporta `failed` quando o enfileiramento lança.
  - **Envio com anexo** (`send-widget-message.use-case.ts`): pré-checagem antes da primeira parte e reserva por parte. Se o limite acaba no meio, para de enviar, registra o que saiu e acrescenta à timeline quantos anexos não foram enviados. Sem nada enviado, a recusa sobe como 429.
  - **Robô "Enviar mensagem"** (`bitrix-robot-webhook-handler.controller.ts`): reserva por destinatário. Os recusados não interrompem o laço, são listados no comentário da timeline e contados na resposta (`refusedByDailyLimit`).
  - **Bot** (`HybridBotSessionAdapter.say`): o sender do contato é envolvido pela cota em `comCotaDiaria`. Na recusa, registra no log do job e não faz o eco no chat, para o histórico não mostrar uma fala que o contato não recebeu. Não relança, para o turno não ser retentado.
- **Por quê:** a pré-checagem dá retorno imediato na tela. A reserva no envio é o que garante o limite, porque a fila pode ter consumido a vaga entre os dois momentos.

### 5. API de uso e de liberação temporária
- **Decisão:**
  - `GET /api/thinkzap/lines/:itemId/settings` passa a devolver o bloco `dailyLimit` na linha Z-API (ausente na oficial; `null` se o contador falhar), calculado por `computeDailyLimitUsage`:
    - `enabled`, `limit`;
    - `sentToday`, `extraToday`, `effectiveLimit`;
    - `remainingPercent`: `null` com o limite desligado; senão `max(0, round((efetivo − enviadas) / efetivo × 100))`;
    - `reached`.
  - `POST /api/thinkzap/lines/:itemId/daily-limit/extra`:
    - corpo `{ amount }`, um inteiro maior que zero validado com zod;
    - exige `connectors:update` e linha habilitada;
    - recusa linha que não é Z-API (`daily_limit_invalid`) e limite gravado desligado (`daily_limit_disabled`);
    - faz INCRBY nos extras do dia e devolve o bloco `dailyLimit` atualizado.
- **Por quê:** uma única fórmula de percentual, testável, evita que front e back divirjam. O front só exibe.

### 6. Front: card na aba Ajustes
- **Decisão:**
  - **Card "Limite diário"** (`limite-diario-card.tsx`), depois de Comportamento. A página passa `provider="ZAPI"` à aba Ajustes da linha não oficial, e o card só aparece com ele. O card tem:
    - o toggle e o input numérico, rastreados em `ajustes-alteracoes.ts`, com validação numérica e contagem de pendências;
    - a barra de progresso com enviadas/efetivo e o percentual restante;
    - o botão "Liberar limite temporário", que abre um diálogo com a quantidade e o texto "vale só para hoje".
  - **Tipos e endpoints:** `use-line-api.ts` ganha os tipos e o método da liberação.
  - **i18n:** pt, en e es.
- **Por quê:** o padrão da barra de salvamento já cobre toggles. Estendê-lo para um campo numérico mantém um único fluxo de salvar.

### 7. Erros catalogados
- **Decisão:** cada código tem guia em `mcp/kb/runbooks/hubcore/thinkzap/line/`, como o teste do catálogo exige.
  - `thinkzap.line.daily_limit_reached`: `validation`, 429.
  - `thinkzap.line.daily_limit_invalid`: `validation`, 400.
  - `thinkzap.line.daily_limit_disabled`: `validation`, 409.
  - `thinkzap.line.daily_limit_usage_read_failed`: falha ao ler o contador na aba.
  - `thinkzap.line.daily_limit_notify_failed`: falha ao avisar o operador.

## Risks / Trade-offs

- **[Perda ou flush do Redis zera a contagem do dia]** → Aceito. A linha pode enviar até um limite a mais naquele dia. As chaves têm TTL curto e nenhum outro dado depende delas.
- **[Reprovisionar a instância muda o `zApiInstanceId` e zera a contagem]** → Raro e aceito. A instância nova é, de fato, outro recurso na Z-API.
- **[Timeout conta como enviado]** → Pode recusar uma mensagem a mais do que o necessário. Foi escolhido de propósito, porque o objetivo é proteger a linha.
- **[Mensagem já pré-checada falha no despacho]** → O usuário viu "enfileirado" e depois recebe a falha na timeline. É o comportamento previsto no spec.
- **[Envio com anexo parcialmente entregue]** → O request responde sucesso com parte dos anexos fora. A timeline diz quantos não foram, e recusar tudo faria o operador reenviar o que o contato já recebeu.

## Fonte da `policy` no caminho de envio (verificado na implementação)

- O PATCH de settings grava pelo `CachedSubscriptionItemRepository`. O `refresh` dele apaga as chaves do item, da listagem e da listagem por assinatura, e regrava o item.
- Por isso, toda `policy` é montada com os settings vindos de `GetAplicationContext`:
  - no operador, o `line.settings` de `findLineItemByInstanceId`;
  - no outbox, os settings que o worker resolve para o `DispatchLineTarget`;
  - no bot, `findLineItemByInstanceId`;
  - no widget, no robô e no enfileiramento, o item resolvido do contexto.

  Nunca se usa o `settings` congelado do contexto do webhook.

## Migration Plan

- Sem migration. Linhas existentes leem `dailyLimitEnabled = false` pelo default do schema e passam a ser contadas a partir do deploy.
- Rollback: reverter o deploy. As chaves Redis expiram sozinhas, e os campos extras no settings da SPA são ignorados pelo schema antigo, que não é estrito.

## Open Questions

- Valor sugerido no placeholder do campo de limite. Não muda o comportamento.
