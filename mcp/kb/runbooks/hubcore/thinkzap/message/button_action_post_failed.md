---
category: integration
audience: suporte
summary: A mensagem com botões não pôde ser postada no canal aberto; nada foi enviado ao contato.
---
# thinkzap.message.button_action_post_failed

## O que significa
O operador montou uma mensagem com botões pela tela do canal aberto, e o app tentou postar o código dela no chat (`im.message.add`) com o token do operador. O Bitrix24 recusou ou não respondeu. **Nada foi enviado ao contato.** A tela recebe `502`.

## Causa provável
- **Operador sem acesso ao chat**: saiu da conversa ou a sessão foi transferida.
- **Token do operador expirado ou sem escopo `im`**.
- **Instabilidade do Bitrix24**.

## Como verificar
1. Filtre os Logs pelo `traceKey` e confirme `código de erro: thinkzap.message.button_action_post_failed`.
2. O log traz `dialogId` e o `err` com a resposta do Bitrix (`ACCESS_DENIED` aponta permissão).

## Como resolver
1. `ACCESS_DENIED`: confirmar que o operador participa do chat; refazer a autorização do ThinkZap no menu do app.
2. Instabilidade: reenviar pela tela.

## Quando escalar
Se o operador participa do chat, autorizou o app e o erro continua. Anexe: `traceKey`, domínio, `dialogId` e o `err`.
