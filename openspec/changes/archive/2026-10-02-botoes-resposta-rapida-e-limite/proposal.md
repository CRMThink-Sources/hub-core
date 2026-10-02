# Proposal

## Why

No envio de botões pelo widget de conversa do ThinkZap, clicar em "+ Resposta rápida" apaga os botões já preenchidos e deixa só um novo, em vez de acrescentar mais um — o operador não consegue montar uma mensagem com várias respostas rápidas. Além disso, a linha não oficial (Z-API) não tem limite de quantidade de botões, permitindo montar envios grandes demais; precisamos limitar a no máximo 5 botões por envio.

## What Changes

- Corrigir a adição de botão de resposta rápida no widget de conversa: adicionar `REPLY` quando a lista já só tem `REPLY` passa a **acrescentar** um botão; a lista só é reiniciada quando o operador troca de tipo (de `REPLY` para `URL`/`CALL` ou vice-versa), igual ao robô de automação já faz.
- Limitar todo envio de botões a **no máximo 5 botões**, em qualquer provider. Os limites mais restritos já existentes da linha oficial (HubMessage: 3 `REPLY` ou 1 `URL`) continuam valendo.
- Aplicar o limite em todas as telas que montam botões (widget de conversa, widget de botões do Canal Aberto, robôs de automação oficial e não oficial): o botão "+ tipo" fica desabilitado ao atingir o limite e a validação exibe a mensagem de máximo.
- Aplicar o mesmo limite no backend (validação por provider), recusando com o erro de "botões demais" já existente quem chamar a API com mais de 5 botões.

## Capabilities

### New Capabilities
- `thinkzap/envio-botoes`: composição e envio de mensagens com botões (resposta rápida, link, ligação) — regras de adição de botões na tela e limite de quantidade por envio.

### Modified Capabilities
<!-- Nenhuma: não existe spec de botões hoje. -->

## Impact

- Front: `front/app/(widgets)/layouts/conversation-view.tsx` (`addButton`, `maxButtons`), `front/app/(widgets)/layouts/button-composer.tsx` (validação/limite), `front/app/bitrix/widget/button/_composition/button-widget-view.tsx`, `front/app/bitrix/bizproc/_shared-button/button-robot-config.ts` e `button-robot-form.tsx`, e testes associados.
- API: `api/src/modules/thinkzap/domain/ports/interactive-button-validation.ts` (limite geral, usado no pré-check do enfileiramento e nos adapters) e seus testes. Os controllers já traduzem `TooManyButtonsError` para resposta de erro.
- Robôs de automação já salvos com mais de 5 botões passam a ser recusados no disparo e a exibir a mensagem de máximo na tela de configuração.
