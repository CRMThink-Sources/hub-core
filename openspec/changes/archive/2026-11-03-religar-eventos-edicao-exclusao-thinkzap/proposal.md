# Proposal

## Why

A instalação do ThinkZap só registra o bind de `ONIMCONNECTORMESSAGEADD`. Os binds de `ONIMCONNECTORMESSAGEUPDATE` (edição) e `ONIMCONNECTORMESSAGEDELETE` (exclusão) foram removidos junto com a descontinuação das sincronizações (commit `fd16b2e5`), e o script `unbind-message-sync-events` tirou os binds das instalações existentes. Resultado: editar ou apagar uma mensagem do operador no Contact Center do Bitrix24 não chega ao WhatsApp, e o cliente fica com a conversa divergente entre CRM e aparelho. A decisão agora é reativar as duas sincronizações, o que exige religar os binds em instalações novas e corrigir os portais que ficaram sem eles.

## What Changes

- O instalador do ThinkZap passa a registrar os três binds: `ONIMCONNECTORMESSAGEADD`, `ONIMCONNECTORMESSAGEUPDATE` e `ONIMCONNECTORMESSAGEDELETE`, pelo `ensureEventBindings` já idempotente.
- Os handlers de webhook `BitrixMessageUpdateHandler` e `BitrixMessageDeleteHandler` voltam a enfileirar o evento em `thinkzap-inbound` em vez de descartá-lo.
- Os processors de edição e exclusão voltam ao worker de entrada (recuperados do histórico, com os tipos `IBX24MessageUpdateEvent`/`IBX24MessageDeleteEvent`), e o `ZApiClient` volta a ter `editMessage` e `deleteMessage` com os códigos de erro `thinkzap.zapi.message_edit_failed` e `thinkzap.zapi.message_delete_failed`.
- `buildConnectorRegisterParams` passa a mandar `EDIT_INTERNAL_MESSAGES: 'Y'`. Com `'N'` o Bitrix não oferece a edição ao operador e nenhum evento de edição é emitido. `DEL_INTERNAL_MESSAGES` já é `'Y'`.
- Nova ação no backoffice, por aplicação, que religa os binds de edição e exclusão no portal do cliente (`event.bind`, idempotente) para corrigir instalações sem eles. A ação também reaplica o `imconnector.register` para garantir a flag de edição.
- O script `unbind-message-sync-events` é removido, para ninguém desfazer o que esta mudança religa.
- **BREAKING** (comportamental): edição e exclusão feitas no CRM voltam a ser refletidas no WhatsApp. A flag de edição no conector só chega aos portais antigos pela ação do backoffice ou por re-registro.

## Capabilities

### New Capabilities
- `thinkzap/sincronizacao-edicao-exclusao-mensagem`: propagação de edição e exclusão de mensagem do operador, feitas no Contact Center do Bitrix24, para o WhatsApp; inclui os binds registrados na instalação.
- `portal-admin/eventos-mensagem-aplicacao`: ação do backoffice que religa os binds de edição e exclusão de mensagem na instalação do ThinkZap de um cliente.

### Modified Capabilities
<!-- Nenhuma: nenhum requisito de spec existente muda. -->

## Impact

- API: `api/src/modules/thinkzap/install/thinkzap.installer.ts` (+ teste), `build-connector-register-params.ts`, `main/bitrix-webhook-handle-controller.ts`, handlers em `shared/infra/handlers/bitrix/`, `workers/thinkzap-inbound.worker.ts`, novos processors em `workers/`, `ZApiClient`, `errors/catalog.ts`, `bitrix-events.interface.ts`.
- Backoffice (API): nova rota `POST /portal/apps/:appId/message-events` em `modules/portal/routes.ts`, controller e caso de uso seguindo `register-connector-for-app`.
- Backoffice (front): botão na seção de conector de `front/components/layouts/admin/admin-client-connector-section.tsx` e textos i18n pt/en/es em `admin/app-settings`.
- Runbooks do MCP de logs (`mcp/kb/runbooks/hubcore/thinkzap/zapi/message_edit_failed.md` e `message_delete_failed.md`) removidos no `fd16b2e5` voltam junto com os códigos de erro.
- Portais: o `event.bind` passa a ser chamado nos portais corrigidos pelo backoffice. Instalações já desbindadas continuam sem os eventos até a ação ser executada.
- Premissa registrada: o toggle por linha (`messageUpdateEventEnabled`/`messageDeleteEventEnabled`) não volta. Os binds são por portal, sempre ligados, e os campos antigos gravados nos itens da SPA seguem ignorados.
