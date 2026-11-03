# Tasks

## 1. Instalação e registro do conector

- [x] 1.1 Extrair a lista dos três eventos (`ADD`, `UPDATE`, `DELETE`) para uma constante exportada do instalador e usá-la em `bindConnectorMessageEvents`; atualizar o comentário da constante. Verificar: `thinkzap.installer.test.ts` espera os três `event.bind` (hoje espera só `ADD`) e passa.
- [x] 1.2 Mudar `EDIT_INTERNAL_MESSAGES` para `'Y'` em `build-connector-register-params.ts` e reescrever o comentário que justificava `'N'`. Verificar: teste do builder cobre `EDIT_INTERNAL_MESSAGES: 'Y'` e `DEL_INTERNAL_MESSAGES: 'Y'`.
- [x] 1.3 Cobrir em `ensure-event-bindings.test.ts` o religamento dos eventos de edição e exclusão (já ligado: nada; handler antigo: unbind + bind). Verificar: `yarn test ensure-event-bindings` passa.

## 2. Provedor: editar e apagar mensagem na Z-API

- [x] 2.1 Restaurar do `fd16b2e5^` `ZApiClient.editMessage` e `deleteMessage`, os códigos `thinkzap.zapi.message_edit_failed` e `message_delete_failed` em `errors/catalog.ts` e os runbooks `mcp/kb/runbooks/hubcore/thinkzap/zapi/message_edit_failed.md` e `message_delete_failed.md`. Verificar: teste do `ZApiClient` cobre o endpoint chamado e o erro tipado em falha; o catálogo de erros e o teste que valida runbook por código passam.
- [x] 2.2 Restaurar `IBX24MessageUpdateEvent` e `IBX24MessageDeleteEvent` em `bitrix-events.interface.ts`. Verificar: `yarn tsc --noEmit` na API sem erro.

## 3. Recepção e processamento dos eventos

- [x] 3.1 Restaurar o enfileiramento em `bitrix-message-update.handler.ts` e `bitrix-message-delete.handler.ts` (log + `enqueueThinkzapInboundJob` com `traceKey`), removendo os comentários de descarte. Verificar: teste de cada handler confirma o job enfileirado com `type` correto e `traceKey`.
- [x] 3.2 Restaurar `bitrix-message-update.processor.ts` e `bitrix-message-delete.processor.ts` e o despacho por `data.type` em `thinkzap-inbound.worker.ts`. Antes de chamar a Z-API, encerrar com log de ignorado quando a linha for oficial (HubMessage). Verificar: testes dos processors cobrem edição/exclusão com sucesso, mensagem sem `providerMessageId`, linha sem contexto, linha oficial (sem chamada ao provedor) e falha do provedor (log sem lançar).
- [x] 3.3 Verificar o despacho no worker. Verificar: teste do `thinkzap-inbound.worker` confirma que `ONIMCONNECTORMESSAGEUPDATE` e `ONIMCONNECTORMESSAGEDELETE` chamam o processor certo e `ADD` segue indo para o de mensagem recebida.

## 4. Backoffice (API)

- [x] 4.1 Criar o caso de uso `bindMessageEventsForApp(appId)` em `modules/portal/application/`: resolve o cliente por `resolveBitrixClientForApp`, liga `UPDATE` e `DELETE` com `ensureEventBindings` (exige `env.bitrix.webhookUrl`, erro de configuração se ausente) e reaplica `ensureConnectorRegistration`. Verificar: teste de unidade cobre portal sem os eventos, com os eventos, segunda execução sem mudança, webhook ausente e falha do registro propagada.
- [x] 4.2 Criar o controller e a rota `POST /portal/apps/:appId/message-events` com `portalAuthMiddleware`, factory ao lado de `create-register-connector-app-controller`, mapeando `PortalDomainNotFoundError` → 404 e `ThinkzapNotInstalledError`/`DomainCredentialMissingError` → 422. Verificar: teste de rota e de controller cobrem sucesso, 404, 422 e 401 sem sessão (padrão de `backoffice-app-routes.test.ts`).

## 5. Backoffice (front)

- [x] 5.1 Adicionar o botão e o estado de carregamento/sucesso/erro à seção do conector em `admin-client-connector-section.tsx`, chamando a rota nova; textos em `front/messages/{pt,en,es}/admin/app-settings.json`. Verificar: teste do componente cobre clique, sucesso, erro e botão desabilitado durante a chamada; as chaves existem nos três idiomas.

## 6. Limpeza

- [x] 6.1 Remover `api/src/scripts/unbind-message-sync-events.ts` e a entrada correspondente no `package.json`, se houver. Verificar: `rtk grep unbind-message-sync` sem resultados.
- [x] 6.2 Rodar `yarn lint`, `yarn tsc --noEmit` e os testes da API e do front. Verificar: tudo verde.
- [ ] 6.3 Verificação de integração em portal de teste: instalar o ThinkZap, conferir `event.get` com os três eventos, editar e apagar uma mensagem do operador numa linha Z-API e ver o efeito no WhatsApp; depois executar a ação do backoffice num portal sem os binds e repetir. Verificar: os efeitos aparecem no aparelho e a segunda execução da ação não duplica binds.
