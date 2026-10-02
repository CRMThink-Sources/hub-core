# Tasks

## 1. Corrigir adição de resposta rápida no widget de conversa

- [x] 1.1 Extrair a regra de adição para uma função pura em `front/app/(widgets)/layouts/button-composer.tsx` (ex.: `appendWidgetButton(previous, type)`) que só reinicia a lista quando `previous.length > 0` e a família muda (`hasReply !== (type === 'REPLY')`), espelhando `addButton` de `button-robot-form.tsx`; verificar com testes em `button-composer.test.ts`: REPLY + REPLY acumula preservando o label do primeiro, lista vazia + REPLY cria um, URL + CALL acumula, URL + REPLY reinicia
- [x] 1.2 Usar a função em `addButton` de `front/app/(widgets)/layouts/conversation-view.tsx` e verificar que `yarn test` e `yarn lint` passam no `front/`

## 2. Limite de 5 botões no front

- [x] 2.1 Em `button-composer.tsx`, exportar `MAX_WIDGET_BUTTONS = 5` e fazer `buttonComposerValidationMessage` e `ButtonComposer` (`atMaxButtons`) usarem `maxButtons ?? MAX_WIDGET_BUTTONS`; atualizar o comentário de `maxButtons`; verificar com testes em `button-composer.test.ts`: 5 botões REPLY válidos retornam `null`, 6 retornam "Esta linha aceita no máximo 5 botão(ões) por envio.", e `maxButtons = 1` continua prevalecendo
- [x] 2.2 Em `front/app/bitrix/bizproc/_shared-button/button-robot-config.ts`, exportar `MAX_ROBOT_BUTTONS = 5` e fazer `validateButtonConfig` usar `maxButtonsByType?.[tipo] ?? MAX_ROBOT_BUTTONS`; atualizar o comentário; verificar com testes em `button-robot-config.test.ts`: 6 botões sem `maxButtonsByType` são recusados com a mensagem de máximo 5, 5 são aceitos, e `{ REPLY: 3 }` continua recusando 4
- [x] 2.3 Em `button-robot-form.tsx`, fazer `isTypeAtMax` usar o mesmo fallback `MAX_ROBOT_BUTTONS`; verificar com `yarn test` e `yarn lint` no `front/` e, manualmente, que no robô não oficial os botões "+ tipo" desabilitam no 5º botão

## 3. Limite de 5 botões na API

- [x] 3.1 Em `api/src/modules/thinkzap/domain/ports/interactive-button-validation.ts`, adicionar `MAX_BUTTONS_PER_SEND = 5` (com comentário do motivo) e lançar `TooManyButtonsError(provider, 5)` depois das checagens por provider (a HubMessage, com limite menor, recusa antes com o próprio máximo); atualizar a doc de `TooManyButtonsError` em `button-errors.ts`; verificar com testes em `interactive-button-validation.test.ts`: Z-API com 5 botões passa, Z-API com 6 lança `TooManyButtonsError` com `max = 5`, HubMessage com 4 REPLY continua lançando com `max = 3`
- [x] 3.2 Verificar que o envio pelo widget recusa 6 botões Z-API sem enfileirar: adicionar/ajustar caso em `enqueue-interactive-button-send.service.test.ts` (ou `enqueue-widget-button.use-case.test.ts`) e rodar `yarn test` e `yarn lint` no `api/`

## 4. Verificação integrada

- [x] 4.1 No widget de conversa com linha Z-API, adicionar 5 respostas rápidas (confirmando que o texto das anteriores é preservado), ver os botões "+ tipo" desabilitados e enviar com sucesso; com linha oficial, confirmar que o limite de 1 link continua
