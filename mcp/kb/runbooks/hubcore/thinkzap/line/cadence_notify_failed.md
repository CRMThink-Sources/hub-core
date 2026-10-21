---
category: integration
audience: suporte
summary: A resposta do operador aguarda a janela de envio, mas o aviso no chat não pôde ser postado.
---
# thinkzap.line.cadence_notify_failed

## O que significa
O operador respondeu um cliente durante uma espera da cadência. A mensagem ficou na fila e **será enviada** quando abrir a janela, mas o aviso de espera no chat do canal aberto não pôde ser postado.

## Causa provável
- **Acesso ao chat**: o Bitrix24 recusou a postagem do aviso pelo bot e pelo app.
- **Indisponibilidade momentânea** do Bitrix24.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.cadence_notify_failed`.
3. Confira no histórico se a mensagem do operador saiu depois da espera.

## Como resolver
1. Nenhuma ação na mensagem: ela sai sozinha na próxima janela.
2. Explique ao operador que a resposta pode demorar quando a linha está em pausa, e que o estado aparece na aba Limites de envio.

## Quando escalar
Se o aviso falhar sempre para a mesma linha, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.cadence_notify_failed`, domínio do parceiro, o horário do evento e o identificador da linha.
