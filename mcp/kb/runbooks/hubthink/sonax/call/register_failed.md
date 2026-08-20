---
category: integration
audience: suporte
summary: Falha ao registrar a chamada externa no Bitrix24, então ela não apareceu na telefonia do portal.
---
# sonax.call.register_failed

## O que significa
Quando uma chamada acontece, o Sonax registra essa ligação na telefonia do Bitrix24 do parceiro, para que ela apareça no portal.

Esse erro quer dizer que esse registro falhou: a chamada não conseguiu ser gravada no Bitrix24 e, por isso, não apareceu na telefonia do portal. Como costuma ser uma falha momentânea, geralmente vale tentar de novo.

## Causa provável
- **Instabilidade momentânea** do Bitrix24 no momento do registro.
- **Credencial de acesso ao portal com problema**: a credencial expirou ou ficou inválida.
- **Restrição temporária no portal** que impediu a gravação da chamada.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.call.register_failed`.
3. Verifique se o erro é pontual ou se está se repetindo, e se o parceiro relata instabilidade no Bitrix24.

## Como resolver
1. Confira nas Configurações do Sonax se a credencial de acesso ao portal está válida.
2. Peça ao parceiro para repetir a ação após alguns minutos.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o erro persiste mesmo com a credencial válida e após novas tentativas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.call.register_failed`, domínio do parceiro e o horário do evento.
