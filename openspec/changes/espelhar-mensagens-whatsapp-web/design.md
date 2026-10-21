# Design

## Context

- O webhook `ReceivedCallback` da Z-API entra por `ReceivedMessageHandler` (`api/src/shared/infra/handlers/z-api/received-message.handler.ts`). Hoje ele faz `if (event.fromMe) return` antes de enfileirar em `thinkzap-inbound`. O worker chama `ProcessZApiInboundMessageUseCase`, que resolve a linha pelo item da SPA, checa o entitlement, resolve a identidade do contato pela cadeia de LID, monta o `ISendMessageData` e chama `imconnector.send.messages`, `update` ou `delete`. Depois persiste o snapshot em `core_thinkerszap_messages`.
- A Z-API só entrega mensagens "enviadas por mim" no `ReceivedCallback` quando a instância tem `notifySentByMe` ligado (`PUT /instances/{id}/token/{token}/update-notify-sent-by-me`, body `{ "notifySentByMe": true }`). Hoje nenhum código liga isso. O `InstanceDataResponse` já expõe `receiveCallbackSentByMe`.
- Nesses eventos, `fromMe=true`, e `fromApi` distingue o envio pela API (`true`: operador no canal aberto, widget, robôs) do envio pelo aparelho ou WhatsApp Web (`false`).
- O padrão de "mensagem do lado da empresa no canal aberto" já existe no widget (`EnsureWidgetOpenChannelConversation` → `BitrixClient.sendToOpenChannel`). Ele usa `imconnector.send.messages` com o prefixo `historyNotices(locale).sentFromCrmPrefix`. `imconnector` só posta como o contato, e as alternativas (`imbot.message.add`, `im.message.add`) foram medidas e descartadas em `post-open-channel-system-notice.ts`. Além disso, `im.message.add` sem `SYSTEM` dispara `ONIMCONNECTORMESSAGEADD` e reenviaria a mensagem ao WhatsApp.
- Postar **como um operador** já é feito no widget de botões (`SendOpenChannelButtonController`): `im.message.add` no chat do canal aberto, com o token do operador vindo de `ResolveOperatorBitrixAccessToken` (tabela `ThinkzapOperatorOAuth`, com refresh). O operador autoriza o app uma vez pelos widgets (`NEED_OPERATOR_OAUTH`). Essa postagem dispara `ONIMCONNECTORMESSAGEADD`, e o `processBitrixReceivedMessage` intercepta o código do botão antes de enviar ao provider.
- O `ONIMCONNECTORMESSAGEADD` é registrado com `auth_type: '0'` (`ensure-event-bindings.ts`), então o `auth` do evento é do usuário que escreveu. Pela doc oficial, porém, o `refresh_token` é opcional nesse `auth` e os tokens "not always passed". O evento não serve de fonte confiável de token, só de complemento.
- A row `BITRIX` gravada em `persistOutboundMessage` não guarda quem respondeu (`message.user_id`).
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
- o autor é o **operador da sessão** (Decisão 7). Só no fallback o `user` do payload `imconnector` é o do **contato**, igual ao inbound, porque o `imconnector` não aceita outro autor. Nos dois casos, o prefixo sinaliza a origem;
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

### 7. Autor = operador da sessão, com fallback para o contato
Substitui o autor da primeira versão (sempre o contato). A mensagem espelhada é postada com `im.message.add` (`DIALOG_ID: chat{bitrixChatId}`, `MESSAGE: prefixo + texto`) usando o token do **operador da sessão**.

- **Operador da sessão** = `bitrixUserId` da row `BITRIX` mais recente daquele `bitrixChatId` (o último operador que respondeu na conversa). Para isso, `persistOutboundMessage` passa a gravar `message.user_id` na coluna nova `bitrix_user_id`, e o repositório ganha `findLatestOperatorForChat(instanceId, bitrixChatId)`.
- **Token**: `ResolveOperatorBitrixAccessToken.execute(domínio, bitrixUserId)`, o mesmo usado pelos widgets.
- **Fallback para o contato** (caminho `imconnector.send.messages` atual) quando: não há operador gravado na conversa; o operador não tem token; o refresh falha; ou o Bitrix recusa a postagem (ex.: `CANCELED` porque o operador não participa mais do chat, ou a sessão foi encerrada). A aba Logs do job registra o autor usado e, no fallback, o motivo.
- *Alternativa*: perguntar o operador ao Bitrix (`imopenlines.dialog.get`). Foi descartada pelo mesmo motivo da Decisão 4: uma chamada REST por mensagem do aparelho.
- *Alternativa*: postar sempre como o usuário que instalou o app (credencial da instalação). Foi descartada porque assina toda mensagem com a mesma pessoa, que pode nem ser operador.
- *Consequência aceita*: a mensagem do operador conta como resposta no canal aberto (tempo de resposta, "respondido"), e é isso que se quer, já que a resposta foi dada pelo aparelho.

### 8. Cobertura de tokens de operador
A fonte de verdade é `ThinkzapOperatorOAuth`. Para cobrir operadores que nunca abriram os widgets, o worker de saída faz **upsert oportunista** (`UpsertOperatorBitrixOAuth`) quando o `auth` do `ONIMCONNECTORMESSAGEADD` traz `access_token` e `refresh_token` e `auth.user_id === message.user_id`. Assim não se grava um token de outro usuário. A falha do upsert só gera log e nunca falha o envio ao contato.
- *Consequência aceita*: um operador que nunca autorizou o app, e cujos eventos chegam sem `refresh_token`, cai no fallback da Decisão 7.

### 9. Anti-loop da mensagem postada como operador
`im.message.add` como operador dispara `ONIMCONNECTORMESSAGEADD`, e sem guard a mensagem seria reenviada ao contato no WhatsApp.
- O use case reserva no Redis a mensagem que postou como operador (mecanismo detalhado no fim desta decisão).
- `processBitrixReceivedMessage`, antes de qualquer envio ao provider, consome a reserva atomicamente. Se ela existia, descarta o evento com log "mensagem espelhada do aparelho" e não envia.
- Segunda camada: se `findByBitrixMessageId` encontra uma row `ZAPI` com aquele `im.message_id`, o evento também é descartado. Isso cobre o evento que chega depois do TTL.
- *Por que não um código no texto* (como no botão): o código ficaria visível na conversa para sempre, enquanto aqui o texto é o próprio conteúdo da mensagem.
- Se a marca de pendente não puder ser gravada (Redis indisponível), o use case **não** posta como operador e cai no fallback do contato, que não gera evento de saída. Isso é falha fechada: melhor autor errado do que mensagem duplicada no WhatsApp do cliente.

**Revisado na implementação: a chave é o id, não o hash do texto.** O `message.text` do `ONIMCONNECTORMESSAGEADD` chega transformado (o exemplo oficial traz `"[b]Klaus Weber:[/b] [br]Guten Tag!"`), então o hash do texto postado não bateria. O mecanismo implementado (`MirroredMessageReservations`):
- antes do `im.message.add`, o chat fica **pendente** (`…:pending:{bitrixChatId}`, contador com TTL de 30 s, para duas cópias simultâneas no mesmo chat não apagarem a marca uma da outra);
- assim que o `im.message.add` devolve o id, a reserva `…:msg:{bitrixMessageId}` é gravada com o id da Z-API (TTL de 5 min);
- o pendente só é limpo **depois** de gravar a row `ZAPI`, então, se a reserva falhar, o worker ainda acha a row;
- o worker de saída (só em linha Z-API) consome a reserva (`MULTI GET+DEL`, sem depender de Redis 6.2). Se não houver reserva mas o chat estiver pendente, ele espera até 5 s por ela. Uma resposta digitada nessa janela só atrasa, nunca é descartada. Depois disso, confere a row `ZAPI` por `bitrixMessageId`;
- ao descartar, o worker confirma a entrega no Bitrix (`setDelivered`) com o id da Z-API, porque a mensagem de fato já está no WhatsApp: saiu do aparelho.

### 10. Autor gravado para edição e remoção
A row `ZAPI` da mensagem espelhada grava em `bitrix_user_id` o operador usado como autor, ou `null` quando saiu como o contato.
- Com autor operador: a edição usa `im.message.update` (`MESSAGE_ID`, prefixo + texto novo) e a remoção usa `im.message.delete`, com o token desse operador. `ONIMCONNECTORMESSAGEUPDATE` e `ONIMCONNECTORMESSAGEDELETE` não estão registrados, então não há loop.
- Sem token desse operador: o evento é descartado com log, sem editar nada. A credencial do app não edita mensagem de outro usuário, como já está registrado em `parse-button-action-code.ts`.
- Com autor `null`: segue o `imconnector.update.messages`/`delete.messages` da primeira versão.

## Risks / Trade-offs

- [`fromApi` ausente ou inconsistente em algum tipo de envio da Z-API, como botões ou documento] → o guard por `providerMessageId` da Decisão 2 descarta qualquer mensagem já registrada. O risco que sobra é a corrida em que o webhook chega antes de o outbound gravar a row, mitigada por depender primeiro de `fromApi`.
- [Volume extra de webhooks com o toggle ligado: toda mensagem enviada pela API também volta] → descarte no handler, sem I/O, antes de enfileirar.
- [Mensagem do aparelho para contato com sessão encerrada reabre a sessão e pode distribuir para um operador] → é a semântica escolhida ("conversa existente" = chat conhecido). Está documentada na dica do toggle.
- [Mensagens enviadas antes de ligar o toggle não são retroativas] → aceito, já que não há histórico na Z-API para buscar.
- [A Z-API pode reentregar o evento] → `jobId` determinístico mais guard por `providerMessageId`.
- [Mensagem como operador reenviada ao WhatsApp] → reserva no Redis mais row `ZAPI` por `bitrixMessageId` (Decisão 9), com falha fechada para o caminho do contato.
- [Operador sem token ou fora do chat] → fallback para o contato (Decisão 7), registrado no log do job. A taxa de fallback mostra quantos operadores ainda precisam autorizar o app.
- [Tokens de usuário individual guardados no banco] → mesma tabela e mesmo refresh que os widgets já usam. O upsert do evento só grava quando `auth.user_id` é o autor da mensagem.
- [Postagem em sessão encerrada recusada pelo Bitrix] → cai no fallback do contato, que reabre a sessão como na primeira versão.

## Open Questions

- **Mídia como operador.** `im.message.add` não anexa arquivo nativo. Nesta iteração, mídia (imagem, vídeo, áudio, documento, sticker) continua saindo como o contato pelo `imconnector`, com o arquivo nativo. O envio como operador via `im.disk.folder.get` + `disk.folder.uploadfile` + `im.disk.file.commit` fica para um spike: medir se funciona com o token do operador no chat do canal aberto e se o `ONIMCONNECTORMESSAGEADD` que ele gera é coberto pela Decisão 9.

## Migration Plan

1. Migration Prisma com o índice `(instance_id, chat_id)` e, na segunda etapa, a coluna nullable `bitrix_user_id` mais o índice `(bitrix_chat_id, created_at)`. Não bloqueia e não tem backfill: rows antigas sem operador só levam ao fallback.
2. Deploy da API: o toggle nasce desligado, então nada muda até alguém ligar.
3. Deploy do front com o toggle.
4. Rollback: desligar o toggle nas linhas que o ligaram (desliga o `notifySentByMe`). Reverter o código volta ao `if (event.fromMe) return`. O índice pode ficar.
