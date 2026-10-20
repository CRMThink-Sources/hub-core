# Design

## Context

- O webhook `ReceivedCallback` da Z-API entra por `ReceivedMessageHandler` (`api/src/shared/infra/handlers/z-api/received-message.handler.ts`). Hoje ele faz `if (event.fromMe) return` antes de enfileirar em `thinkzap-inbound`. O worker chama `ProcessZApiInboundMessageUseCase`, que resolve a linha pelo item da SPA, checa o entitlement, resolve a identidade do contato pela cadeia de LID, monta o `ISendMessageData` e chama `imconnector.send.messages`, `update` ou `delete`. Depois persiste o snapshot em `core_thinkerszap_messages`.
- A Z-API só entrega mensagens "enviadas por mim" no `ReceivedCallback` quando a instância tem `notifySentByMe` ligado (`PUT /instances/{id}/token/{token}/update-notify-sent-by-me`, body `{ "notifySentByMe": true }`). Hoje nenhum código liga isso. O `InstanceDataResponse` já expõe `receiveCallbackSentByMe`.
- Nesses eventos, `fromMe=true`, e `fromApi` distingue o envio pela API (`true`: operador no canal aberto, widget, robôs) do envio pelo aparelho ou WhatsApp Web (`false`).
- O padrão de "mensagem do lado da empresa no canal aberto" já existe no widget (`EnsureWidgetOpenChannelConversation` → `BitrixClient.sendToOpenChannel`). Ele usa `imconnector.send.messages` com o prefixo `historyNotices(locale).sentFromCrmPrefix`. `imconnector` só posta como o contato, e as alternativas (`imbot.message.add`, `im.message.add`) foram medidas e descartadas em `post-open-channel-system-notice.ts`. Além disso, `im.message.add` sem `SYSTEM` dispara `ONIMCONNECTORMESSAGEADD` e reenviaria a mensagem ao WhatsApp.
- Toggles da linha vivem em `item.settings` (`ConnectorSettings`, item da SPA). Quem grava é `UpdateLineSettings`, que já faz espelho na Z-API, tolerante a falha, para o nome.

## Goals / Non-Goals

**Goals:**
- Reaproveitar o pipeline Z-API existente (resolução de linha, identidade, arquivos, citação, edição e remoção, snapshot) em vez de duplicá-lo.
- Nunca postar duas vezes a mesma mensagem e nunca criar loop de reenvio ao WhatsApp.
- Descarte sempre explícito na aba Logs do job, como no resto do fluxo.

**Non-Goals:**
- Verificar se a **sessão** do canal aberto está aberta ou fechada. "Conversa existente" é chat conhecido (ver Decisão 4).
- Diferenciar celular de WhatsApp Web: a Z-API não informa isso, e o prefixo é um só.
- Linha oficial (HubMessage) e mensagens de status ou "visto".
- Backfill: o toggle nasce desligado, então nenhuma instância existente precisa de chamada.

## Decisions

### 1. Filtro em duas camadas: handler barato, use case com contexto
O handler passa a descartar apenas `fromMe && fromApi`. O caso `fromMe && !fromApi` é enfileirado com `type: 'sent-by-me'` e o mesmo `jobId` determinístico com prefixo próprio (`zapi-me-…`, `zapi-me-edit-…`, `zapi-me-revoke-…`), para não colidir com inbound.

O toggle **não** é checado no handler: isso exigiria resolver o item da SPA no request HTTP do webhook. A checagem fica no worker, onde o item já é resolvido.
- *Alternativa*: checar o toggle no handler com cache. Foi descartada porque duplicaria a resolução de linha e o webhook precisa responder rápido.

### 2. Use case irmão que reaproveita o pipeline, não um `if` dentro do inbound
Um `MirrorZApiSentByMeMessageUseCase` novo. O que é comum ao inbound é extraído para helpers compartilhados: resolução de linha, entitlement, canal e credencial, `buildMessageFiles`, `resolveInboundText`, `buildContactText`, `applyReplyContext` e `persistInboundSnapshot`. As diferenças:
- checa `item.settings.deviceMessageMirrorEnabled` logo depois de resolver o item;
- **guard de duplicidade**: `messageRepo.findByProviderMessageId(instance.id, event.messageId)`. Se existir row, a mensagem já é conhecida (enviada pela integração ou já espelhada) e é descartada. Isso cobre `fromApi` ausente ou errado;
- **guard de conversa existente** (Decisão 4);
- texto final = `historyNotices(locale).sentFromDevicePrefix + texto`. Em grupo **não** leva `[b]senderName[/b]:`, porque o autor é a própria linha;
- `user` do payload é o do **contato**, igual ao inbound. O `imconnector` não aceita outro autor, e o prefixo é o que sinaliza a origem;
- identidade 1:1: na mensagem enviada, `phone` e `chatLid` são do **destinatário**, então a mesma `resolveContactIdentity` usada no inbound produz o mesmo `chat.id`. `senderName` e `senderPhoto` são da própria linha e não entram no nome do contato. O nome usa `chatName` e o telefone.
- *Alternativa*: um ramo `if (event.fromMe)` dentro de `ProcessZApiInboundMessageUseCase`. Foi descartada porque o use case já tem cerca de 1000 linhas e três desfechos sem mensagem nova. Mais um eixo tornaria a aba de logs ilegível.

### 3. Snapshot com `source: 'ZAPI'`
A mensagem espelhada grava a row normal (`providerMessageId = event.messageId`, `bitrixMessageId`, `bitrixChatId`, `chatId`). Isso dá de graça a citação de resposta, a edição e remoção (que procuram a row pelo id original) e a idempotência do guard da Decisão 2.

O enum `ThinkzapMessageSource` não ganha valor novo, porque nenhum consumidor precisa distinguir.

Edição e remoção (`isEdit` com `editMessageId`, `notification === 'REVOKE'`) só seguem se `findByProviderMessageId` do id original existir. Assim, edição de mensagem não espelhada não abre nada.

### 4. "Conversa existente" = row com `bitrixChatId` para `(instanceId, chatId)`
Novo método `findLatestOpenChannelChat(instanceId, chatId)` no `PrismaThinkzapMessageRepository`: a row mais recente daquela identidade com `bitrixChatId` não nulo. A identidade é a mesma do inbound (LID no 1:1, jid do grupo no grupo). Rows do widget gravam `chatId` com a mesma identidade em `updateOpenChannelRefs`.

Precisa de `@@index([instanceId, chatId])`: hoje só existe `(instanceId, createdAt)`.
- *Alternativa*: perguntar ao Bitrix (`imopenlines.dialog.get` por `USER_CODE`). Foi descartada porque custa uma chamada REST por mensagem do aparelho, sujeita a `OPERATION_TIME_LIMIT`, e o Bitrix não expõe de forma confiável se a sessão está ativa.
- *Consequência aceita*: se a sessão daquele chat já foi encerrada, o `imconnector.send.messages` reabre uma sessão nova no mesmo chat. É o mesmo comportamento de uma mensagem recebida do contato.

### 5. Toggle ↔ `notifySentByMe` em `UpdateLineSettings`, antes de qualquer escrita
`ConnectorSettings.deviceMessageMirrorEnabled: boolean` (default `false`, `z.boolean().optional()` no schema). Em `UpdateLineSettings.execute`, quando o patch traz o campo **e** o valor difere do gravado:
- linha não Z-API → erro de validação, junto do `assertDailyLimitPatch`;
- chama `ZApiClient.updateNotifySentByMe(id, token, value)` **antes** de gravar nome e settings. Se falhar, lança um erro de catálogo novo (`thinkzap.zapi.notify_sent_by_me_failed`) e nada é gravado.

Isso é o oposto do rename, que é tolerante, e é proposital. Toggle gravado ligado sem a Z-API notificar é um recurso "ligado" que nunca funciona. O inverso (desligar falhou) seria só tráfego extra, já filtrado pelo worker, mas fica estrito também, por simetria e para o estado bater.

### 6. Prefixo novo em `history-notices.ts`
`sentFromDevicePrefix`:
- pt: `[Mensagem enviada pelo WhatsApp do aparelho]\n`
- en: `[Message sent from the device's WhatsApp]\n`
- es: `[Mensaje enviado desde el WhatsApp del dispositivo]\n`

O locale vem do `InstallationLocale` (`make-installation-locale.ts`), com fallback `pt` sem lançar, como em `EnsureWidgetOpenChannelConversation.localeOrDefault`.

## Risks / Trade-offs

- [`fromApi` ausente ou inconsistente em algum tipo de envio da Z-API, como botões ou documento] → o guard por `providerMessageId` da Decisão 2 descarta qualquer mensagem já registrada. O risco que sobra é a corrida em que o webhook chega antes de o outbound gravar a row, mitigada por depender primeiro de `fromApi`.
- [Volume extra de webhooks com o toggle ligado: toda mensagem enviada pela API também volta] → descarte no handler, sem I/O, antes de enfileirar.
- [Mensagem do aparelho para contato com sessão encerrada reabre a sessão e pode distribuir para um operador] → é a semântica escolhida ("conversa existente" = chat conhecido). Está documentada na dica do toggle.
- [Mensagens enviadas antes de ligar o toggle não são retroativas] → aceito, já que não há histórico na Z-API para buscar.
- [A Z-API pode reentregar o evento] → `jobId` determinístico mais guard por `providerMessageId`.

## Migration Plan

1. Migration Prisma só com o índice `(instance_id, chat_id)`. Não bloqueia e não tem backfill.
2. Deploy da API: o toggle nasce desligado, então nada muda até alguém ligar.
3. Deploy do front com o toggle.
4. Rollback: desligar o toggle nas linhas que o ligaram (desliga o `notifySentByMe`). Reverter o código volta ao `if (event.fromMe) return`. O índice pode ficar.
