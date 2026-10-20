# Tasks

## 1. Toggle e configuração da linha (API)

- [x] 1.1 Adicionar `deviceMessageMirrorEnabled` em `ConnectorSettings` (default `false`) e em `connector-settings.schema.ts` (`z.boolean().optional()`). Verificar com teste de `parseConnectorSettings`: item sem a chave lê `false`, e o valor gravado é preservado no merge.
- [x] 1.2 Expor o campo em `line-settings.mapper.ts` e aceitar no zod de `update-line-settings.controller.ts`. Verificar com teste do mapper.
- [x] 1.3 Adicionar `ZApiClient.updateNotifySentByMe(instanceId, token, enabled)` (`PUT /update-notify-sent-by-me`, body `{ notifySentByMe }`) e o erro de catálogo `thinkzap.zapi.notify_sent_by_me_failed` em `errors/catalog.ts`. Verificar com teste em `z-api.client.test.ts` (URL, body e erro de catálogo na falha).
- [x] 1.4 Em `UpdateLineSettings`: recusar o campo em linha não Z-API, junto do `assertDailyLimitPatch`. Quando o valor muda, chamar `updateNotifySentByMe` antes de gravar nome e settings. Na falha, lançar sem gravar nada. Sem mudança no valor, não chamar. Ajustar a factory para injetar o client. Verificar com casos novos em `update-line-settings.test.ts` (liga, desliga, falha sem gravar, nome só sem chamada, HubMessage recusada).

## 2. Toggle na aba Ajustes (front)

- [x] 2.1 Adicionar `deviceMessageMirrorEnabled` em `use-line-api.ts` e em `ajustes-alteracoes.ts` para contar como alteração pendente. Verificar com o teste existente de contagem de alterações, se houver, ou checagem manual da barra mostrando "1 alteração".
- [x] 2.2 Renderizar o toggle no card Comportamento de `ajustes-tab.tsx` só em linha Z-API, desabilitado sem canal vinculado ou com a linha bloqueada. Verificar abrindo a aba numa linha Z-API e numa HubMessage.
- [x] 2.3 Textos `toggles.deviceMessageMirror`, `toggles.deviceMessageMirrorHint` (deixar claro que só entra em conversa existente) e a dica sem canal em `messages/{pt,en,es}/thinkzap/configuracoes/ajustes.json`. Verificar com o build do front (`next build` ou typecheck de mensagens) sem chave faltando.

## 3. Prefixo e persistência

- [x] 3.1 Adicionar `sentFromDevicePrefix` em `history-notices.ts` nos 3 idiomas. Verificar com `notices-catalog.test.ts`: todo idioma tem o texto.
- [x] 3.2 Migration Prisma com `@@index([instanceId, chatId])` em `ThinkzapMessage`. Verificar com `prisma migrate dev` gerando só o `CREATE INDEX`.
- [x] 3.3 `PrismaThinkzapMessageRepository.findLatestOpenChannelChat(instanceId, chatId)`, que devolve a row mais recente com `bitrixChatId` não nulo, ou `null`. Verificar com teste do repositório.

## 4. Webhook e fila

- [x] 4.1 Em `ReceivedMessageHandler`: descartar só `fromMe && fromApi` (com log debug). Enfileirar `fromMe && !fromApi` com `type: 'sent-by-me'`. Estender `resolveZApiInboundJobId` com os prefixos `zapi-me-`, `zapi-me-edit-` e `zapi-me-revoke-`. Verificar com casos novos em `received-message.handler.test.ts` (API descartada, aparelho enfileirado com tipo e jobId corretos, inbound inalterado).
- [x] 4.2 Em `thinkzap-inbound.worker.ts`, rotear `source: 'z-api'` + `type: 'sent-by-me'` para um processor novo (`z-api-sent-by-me.processor.ts`) montado como `processZApiReceivedMessage`. Verificar com typecheck (`tsc --noEmit`) e um teste de roteamento, se o worker já tiver.

## 5. Use case de espelhamento

- [x] 5.1 Extrair de `process-z-api-inbound-message.use-case.ts` os helpers compartilhados: resolução de linha, entitlement, canal e credencial, `buildMessageFiles`, `resolveInboundText`, `buildContactText`, `applyReplyContext` e `persistInboundSnapshot`. Comportamento do inbound inalterado. Verificar com `process-z-api-inbound-message.use-case.test.ts` passando sem alteração.
- [x] 5.2 Criar `MirrorZApiSentByMeMessageUseCase`, caminho 1:1. Ordem: linha, entitlement e toggle; guard `findByProviderMessageId`; identidade via `resolveContactIdentity` (destinatário); guard `findLatestOpenChannelChat`; texto com `sentFromDevicePrefix` no locale da instalação (fallback `pt`); nome do contato via `chatName` e telefone, nunca `senderName`; `sendMessage`; snapshot. Cada descarte com linha na aba Logs do job e sem lançar. Verificar com testes: espelha com conversa, descarta sem conversa, toggle off, entitlement inativo, mensagem já registrada, prefixo por idioma, mídia com legenda e contato encaminhado.
- [x] 5.3 Caminho de grupo: `chat.id` do grupo (`resolveGroupChatId`), sem prefixo `[b]senderName[/b]`, com o mesmo guard de conversa existente. Verificar com teste de grupo com e sem conversa.
- [x] 5.4 Edição e remoção: só seguem se a row do id original (`editMessageId` ou `messageId`) existir; aí `updateMessage` ou `deleteMessage` com o prefixo mantido no texto editado. Verificar com testes de edição e remoção de mensagem espelhada e não espelhada.

## 6. Verificação integrada

- [ ] 6.1 Em homolog, com uma linha Z-API e o toggle ligado: conferir na Z-API (`GET /me` ou instance data) `receiveCallbackSentByMe=true`. Enviar pelo WhatsApp Web para um contato com conversa (aparece com prefixo), para um contato sem conversa (nada aparece; aba Logs diz "sem conversa existente") e responder pelo canal aberto (sem duplicar). Editar e apagar a mensagem espelhada. Desligar o toggle e confirmar `receiveCallbackSentByMe=false`.
- [x] 6.2 Rodar a suíte da API (`npm test` em `api/`) e o lint e typecheck de `api/` e `front/` sem falhas.
