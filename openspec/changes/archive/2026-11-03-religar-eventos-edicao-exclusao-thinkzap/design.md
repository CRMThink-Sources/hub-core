# Design

## Context

Ver proposal.md (Why) para a motivação. Estado atual, observado no código:

- `ThinkzapInstaller` registra só `ONIMCONNECTORMESSAGEADD` (`CONNECTOR_MESSAGE_EVENTS`), via `ensureEventBindings`, que lê `event.get` e é idempotente, inclusive na troca de URL do webhook.
- `BitrixMessageUpdateHandler` e `BitrixMessageDeleteHandler` seguem registrados no `EventRegistry` do webhook (`bitrix-webhook-handle-controller.ts`), mas só logam e respondem 200.
- O commit `fd16b2e5` apagou `bitrix-message-update.processor.ts`, `bitrix-message-delete.processor.ts`, o ramo do `thinkzap-inbound.worker.ts`, `ZApiClient.editMessage/deleteMessage`, os tipos `IBX24MessageUpdateEvent/DeleteEvent`, os dois códigos de erro e os runbooks. Tudo isso está no histórico e o código removido é pequeno e autocontido.
- O mesmo commit removeu a ação de backoffice `update-thinkzap-connector-event-binds` (bind/unbind por toggle) e os toggles por linha `messageUpdateEventEnabled`/`messageDeleteEventEnabled`.
- `buildConnectorRegisterParams` manda `EDIT_INTERNAL_MESSAGES: 'N'` e `DEL_INTERNAL_MESSAGES: 'Y'`. Sem a flag de edição ligada o Bitrix não emite `ONIMCONNECTORMESSAGEUPDATE`.
- O backoffice já tem a ação `POST /portal/apps/:appId/connector`, que chama `ensureConnectorRegistration` com o cliente resolvido por `resolveBitrixClientForApp`, e a seção de front `admin-client-connector-section.tsx`.
- `unbind-message-sync-events.ts` desfaz os binds das instalações existentes e existe só para a descontinuação.

## Goals / Non-Goals

**Goals:**
- Instalações novas já nascem com os três binds e a flag de edição ligada.
- Um caminho no backoffice, por instalação, que corrige portais sem os binds.
- Reaproveitar o que já existe (`ensureEventBindings`, `resolveBitrixClientForApp`, a seção do conector) e restaurar o código removido do histórico em vez de reescrever.

**Non-Goals:**
- Ação em lote sobre todas as instalações. A decisão foi por botão por portal. O que fica para depois, se o volume de portais pedir, é um script de lote nos moldes de `reregister-connector.run.ts`.
- Reintroduzir toggles por linha ou persistência em `ufCrm93Settings`. Os binds são por portal e sempre ligados.
- Edição e exclusão em linha oficial (HubMessage): a API oficial não oferece as operações.

## Decisions

**1. Fonte única da lista de eventos.** Extrair os três nomes de evento para uma constante exportada junto do instalador e usá-la tanto em `install()` quanto na ação do backoffice. Alternativa: duplicar a lista na ação. Rejeitada, porque as duas divergiriam no primeiro evento novo, o mesmo argumento de `buildConnectorRegisterParams`.

**2. Ação do backoffice reaproveita `ensureEventBindings` + `ensureConnectorRegistration`.** Nova rota `POST /portal/apps/:appId/message-events`, com caso de uso `bindMessageEventsForApp(appId)` ao lado de `registerConnectorForApp`. Ele liga só UPDATE e DELETE (o ADD é parte do fluxo de recepção e já está presente em todo portal em operação) e depois reaplica o `imconnector.register`, porque sem `EDIT_INTERNAL_MESSAGES: 'Y'` o bind de edição não serve de nada. Alternativas: (a) estender `POST /connector` para também religar eventos: mistura duas responsabilidades e muda uma ação que o suporte já conhece; (b) devolver a ação por toggle do `fd16b2e5`: reintroduz estado por linha sem uso. Mantém os erros de domínio já mapeados (`PortalDomainNotFoundError`, `ThinkzapNotInstalledError`, `DomainCredentialMissingError`).

Corolário: o front ganha um botão novo na seção do conector, e não uma tela nova. Resultado da ação é `{ result: 'bound' }`, com texto i18n próprio nos três idiomas.

**3. Handlers voltam a enfileirar.** `BitrixMessageUpdateHandler` e `BitrixMessageDeleteHandler` voltam à forma anterior ao `fd16b2e5` (log + `enqueueThinkzapInboundJob` com `traceKey`). O `thinkzap-inbound.worker.ts` volta a despachar por `data.type`. O processamento continua no worker: o webhook responde rápido e a falha do provedor não gera reentrega do Bitrix.

**4. Processors restaurados com um ajuste.** Voltam como estavam: contexto por `getContext`, busca da mensagem por `findByBitrixMessageId`, chamada à Z-API best-effort, falha só em log. Ajuste: antes de chamar a Z-API, se a linha for oficial (HubMessage) o processor encerra com log de "ignorado" e sem chamar o provedor. A Z-API aceita edição só dentro da janela do WhatsApp e apagar para todos só dentro do prazo do próprio WhatsApp, então falha é esperada e fica em `warn`. O erro tipado `thinkzap.zapi.message_edit_failed`/`message_delete_failed` é restaurado junto com os runbooks do MCP, para o suporte triar a falha.

**5. Flag de edição do conector.** `EDIT_INTERNAL_MESSAGES` passa a `'Y'` e o comentário que justificava o `'N'` é reescrito. Para portais antigos o valor só chega por `imconnector.register`, que a ação do backoffice (decisão 2) e `reregister-connector.run.ts` já fazem com o corpo completo.

**6. Remover `unbind-message-sync-events.ts`.** Ele só tem sentido na descontinuação, e deixá-lo no repositório convida a desfazer esta mudança. Também sai o comentário "Temporário por construção" dos handlers.

**7. Specs existentes.** `thinkzap/configuracao-linha` fala de toggles de comportamento, mas não cita os de edição e exclusão, então nenhum requisito existente muda e não há delta modificado.

## Risks / Trade-offs

- [Webhook de produção recebe volume novo de eventos dos portais corrigidos] → o handler só enfileira, e a fila `thinkzap-inbound` já absorve `ADD`; acompanhar a profundidade da fila após os primeiros portais corrigidos.
- [Portal antigo com bind religado mas `EDIT_INTERNAL_MESSAGES: 'N'`] → a ação do backoffice sempre reaplica o registro; o resultado só é sucesso se as duas chamadas passarem. Uma falha em `imconnector.register` aparece como erro ao administrador, e re-executar é seguro.
- [`ensureEventBindings` troca o handler antigo por um novo no mesmo evento] → é o comportamento desejado (evita bind duplicado), mas significa que um portal com bind apontando para outro webhook é religado para o atual. Aceito.
- [Exclusão tem efeito destrutivo no WhatsApp do contato] → só dispara de ação explícita do operador no Contact Center e só para mensagem com `providerMessageId` conhecido; sem correspondência no banco, nada é enviado.
- [Linha oficial: `findByBitrixMessageId(instanceId, …)` pressupõe instância Z-API] → o processor precisa confirmar o tipo de provider do contexto antes de usar `context.instance`; tarefa 3.2 cobre com teste.
- [Mensagens enviadas antes da restauração podem não ter `providerMessageId`] → o processor registra e ignora; sem migração.

## Migration Plan

1. Publicar a API com instalador, handlers, processors e `EDIT_INTERNAL_MESSAGES: 'Y'`. Instalações novas já nascem corretas; os portais existentes seguem como estão, sem efeito.
2. Publicar o front com o botão novo.
3. Suporte executa a ação nos portais que reclamarem ou que se queira corrigir. Cada execução é idempotente.
4. Rollback: reverter o deploy da API. Os binds já religados passam a bater em handlers que só descartam (versão anterior), com resposta 200, sem reentrega. Quem quiser limpar usa `event.unbind` manual.
