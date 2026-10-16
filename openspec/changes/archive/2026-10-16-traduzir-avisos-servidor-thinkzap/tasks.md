# Tasks

## 1. Base: idioma e catálogo de textos

- [x] 1.1 Confirmar que o mecanismo da change `limite-diario-mensagens-linha` está na branch: `core_apps.locale`, `InstallationLocaleRepository`, `PUT /api/thinkzap/locale` e a gravação no menu. Verificar que `openspec validate limite-diario-mensagens-linha --strict` passa e que o repositório existe em `api/src/modules/thinkzap/infra/persistence/repositories/prisma-installation-locale.repository.ts`.
- [x] 1.2 Mover `NoticeLocale`, `NOTICE_LOCALES`, `DEFAULT_NOTICE_LOCALE` e `parseNoticeLocale` para `domain/notices/notice-locale.ts`, com `daily-limit-notices.ts` reexportando. Verificar com os testes existentes de `daily-limit-notices` e com o typecheck.
- [x] 1.3 Criar o catálogo `domain/notices/` (decisão 1): `open-channel-notices.ts`, `delivery-failure-notices.ts`, `timeline-notices.ts`, `connection-notices.ts` e `history-notices.ts`, cada um como `Record<NoticeLocale, …>` com pt (texto atual, sem mudar uma vírgula), en e es. Verificar com um teste de paridade: para cada grupo, os três idiomas têm as mesmas chaves e todo texto é não vazio e interpola os dados recebidos. Também verificar que o pt de cada texto é idêntico ao texto de hoje.

## 2. Chat do canal aberto

- [x] 2.1 `notify-operator-window-closed.ts` e `notify-operator-button-action-failed.ts` recebem `locale` (padrão `pt`). Em `workers/bitrix-received-message.processor.ts`, ler `byAppId(context.app.id)` só nos ramos que postam esses avisos. Verificar com testes do processor: janela fechada em `en`, botões corrompidos em `es`, motivo do validador preservado, e padrão `pt` sem idioma.
- [x] 2.2 `describe-hubmessage-delivery-failure.ts` recebe `locale` para todas as variantes e para o prefixo. Em `process-hubmessage-delivery-status.use-case.ts`, ler `byInstallation(domainId, thinkzapAppCodeId)` antes de montar o aviso. Verificar com os testes existentes, que continuam em `pt` sem mudança, e com casos novos: 131026 em `es`, genérica em `en` preservando o retorno do provedor, e "sem motivo" em `en`.
- [x] 2.3 Resumo do bot (decisão 4): `buildHandoffSummary` recebe `locale`; `advance` e `runBotTurn` repassam; `workers/bitrix-bot-event.processor.ts` resolve o idioma uma vez por turno. Verificar com testes de `handoff-summary` (título e "não respondeu nada" em `en`, rótulos do autor intactos) e de `run-bot-turn` (o idioma chega ao resumo).

## 3. Timeline do CRM

- [x] 3.1 `notify-widget-send-outcome.ts`: `failed` e `unknown` passam a usar o catálogo com `locale`. O `daily-limit` já usa. `notifySentFor`, em `workers/thinkzap-widget-send.processor.ts`, monta "Para / Template / Mensagem" pelo catálogo. O worker lê `byInstallation(row.domainId, row.appCode)` só quando vai comentar. Verificar com testes de `notify-widget-send-outcome` em `en` e `es`, e de que a linha `Template:` continua presente na confirmação de template em todos os idiomas.
- [x] 3.2 `send-widget-message.use-case.ts`: o comentário "De / Para / Mensagem" vem do catálogo, no mesmo idioma já lido para o aviso de anexos. Verificar com teste em `en`.
- [x] 3.3 Robôs (`bitrix-robot-webhook-handler.controller.ts`, `bitrix-button-robot-webhook-handler.controller.ts`, `bitrix-template-robot-webhook-handler.controller.ts`): todos os comentários de timeline vêm do catálogo com `byAppId(app.id)`. Injetar o repositório pelas factories. Verificar com testes de cada robô: um caso de recusa e um de "enfileirado para", em `en` ou `es`, com telefones, template e erro de validação preservados.

## 4. Sininho do Bitrix

- [x] 4.1 `workers/thinkzap-connection-notify.processor.ts`: `buildMessage` usa o catálogo com `byAppId(app.id)`, para conectado e desconectado, com e sem motivo. Verificar com testes do processor em `en`, com o motivo da desconexão preservado.

## 5. Histórico do canal aberto

- [x] 5.1 `BitrixClient.sendToOpenChannel` recebe o prefixo como parâmetro opcional, com o padrão em pt atual (decisão 5). `resolveOpenChannelText` e os marcadores de anexo recebem `locale`. `ensure-widget-open-channel-conversation.ts` lê `byInstallation` pelo job e passa o prefixo traduzido. Verificar com testes:
  - `describe-attachment-text` em `es`;
  - `ensure-widget-open-channel-conversation` em `en`;
  - o padrão do `sendToOpenChannel` mantém o texto atual para os outros chamadores.

  Nota da implementação: `ensure-widget-open-channel-conversation` é o único chamador do `sendToOpenChannel`. O padrão do parâmetro é o texto antigo, e os testes do caso de uso conferem o prefixo pt sem idioma. A leitura do idioma é à prova de erro: se falhar, posta em português em vez de falhar o job.

## 6. Verificação

- [x] 6.1 Rodar os testes, o lint e o typecheck do `api/` e verificar que tudo passa. Rodar `openspec validate traduzir-avisos-servidor-thinkzap --strict` e verificar que passa.
- [ ] 6.2 Revisão dos textos em inglês e espanhol por quem o time indicar (Open Questions do design), antes do release.
- [ ] 6.3 Em staging, com o idioma do app em inglês:
  1. disparar a janela de 24h fechada numa linha oficial;
  2. gerar uma falha de envio pelo widget;
  3. rodar o robô de template;
  4. desconectar uma linha Z-API;
  5. enviar pelo widget com o espelho no canal aberto ligado.

  Verificar que cada aviso sai em inglês. Depois, voltar o idioma para português e verificar que voltam ao texto de hoje.
