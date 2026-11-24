# Tasks

## 1. Formatação do comentário

- [x] 1.1 Criar helper de BBCode em `modules/thinkzap/domain/notices/` (`escapeBbcode`, linha rotulada, bloco de citação) com testes, incluindo `[/quote]` e `[url]` digitados pelo operador
- [x] 1.2 Reescrever `widgetSentQueued`, `widgetSentSync`, `widgetFailed` e `widgetUnknown` em pt/en/es com o helper; manter a linha `Template:` idêntica nos três idiomas
- [x] 1.3 Reescrever `sendRobot.result/noRecipients`, `buttonRobot.queued` e `templateRobot.queued` no mesmo layout; ajustar `dailyLimitNotices` ao novo padrão
- [x] 1.4 Expor `sentBy(name)` no catálogo (`Enviado por:` / `Sent by:` / `Enviado por:`), usado como `senderLine` no fallback, e atualizar `notices-catalog.test.ts` e os testes dos controllers

## 2. Autor no contrato de notificação

- [x] 2.1 Adicionar `authorBitrixUserId?` a `SendNotificationInput` (`shared/data/contracts/send-notification.ts`)
- [x] 2.2 Em `BitrixLivefeedNotificationService`, receber `resolveAuthorClient` opcional; publicar com o token do autor e cair no client da instalação só em recusa explícita de acesso/token, no máximo uma vez; registrar `authorMode` em log
- [x] 2.3 Obter o nome do remetente (`user.get`) só no fallback; falha omite a linha
- [x] 2.4 Testes do serviço: com token, sem token (`null`), refresh que lança, acesso negado, erro ambíguo (não duplica)

## 3. Widget

- [x] 3.1 `send-widget-message.use-case.ts`: passar `operatorBitrixUserId` como autor no comentário do envio com anexo
- [x] 3.2 `thinkzap-widget-send.processor.ts` (`notifySentFor`/`makeNotifier`): passar `row.operatorBitrixUserId` como autor e montar o serviço com o resolvedor de token
- [x] 3.3 `notify-widget-send-outcome.ts` e chamadores: autor também nos avisos de falha, sem confirmação e limite diário
- [x] 3.4 Conferir nos enfileiradores (`enqueue-widget-message`, `enqueue-template-send`, `enqueue-interactive-button-send`, `enqueue-widget-attachments`) que `operatorBitrixUserId` é gravado em todos os caminhos; cobrir com testes de caso de uso/worker

## 4. Robôs do Bizproc

- [x] 4.1 Nos controllers de disparo, template e botão (e nos `make-*`), passar `auth.user_id` como autor ao comentar na timeline
- [x] 4.2 Tratar `user_id` vazio ou `0` como sem autor (fallback) e cobrir com testes dos controllers
- [ ] 4.3 Validar em staging o que vem em `auth` do robô (Open Questions do design); só então decidir se guarda o token do payload

## 5. Wiring e verificação

- [x] 5.1 Criar fábrica do resolvedor de token reaproveitando `ResolveOperatorBitrixAccessToken` + `BitrixClient.withUserToken` (como em `make-mirror-operator-author.ts`) e ligar nos `make-*` e no worker
- [x] 5.2 Em `api/`: `yarn check-types`, `yarn lint` (zero warnings) e `yarn test`
- [ ] 5.3 Validar em staging: operador autorizado, operador sem autorização, template pela fila, anexo, falha de envio e robô; conferir autor e layout nos três idiomas
- [ ] 5.4 Branch `task/comentario-timeline-autor-remetente`; registrar no commit/PR a validação pendente em staging e arquivar a change após o deploy
