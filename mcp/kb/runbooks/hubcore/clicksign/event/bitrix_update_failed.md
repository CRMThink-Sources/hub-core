---
category: integration
audience: suporte
summary: O evento da Clicksign chegou, mas a atualização do card ou do negócio no Bitrix24 falhou.
---
# clicksign.event.bitrix_update_failed

## O que significa
A Clicksign avisou que algo aconteceu com um documento (assinatura, recusa, cancelamento ou prazo). O CRMThink tentou refletir isso no Bitrix24, atualizando o card da atividade e os campos do negócio, e o Bitrix24 recusou a gravação. O card fica com o status antigo.

## Causa provável
- **Permissão de CRM do app** retirada no portal.
- **Atividade ou negócio apagado** no Bitrix24 depois do envio.
- **Instabilidade do Bitrix24** no momento do aviso.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` ou pelo `documentKey`.
2. Confirme `código de erro: clicksign.event.bitrix_update_failed`.
3. O log traz `event` (qual aviso), `documentKey` e o `err` com a resposta do Bitrix24.

## Como resolver
1. Permissão: reautorizar o app no portal com acesso ao CRM.
2. Registro apagado: nada a recuperar no card; o status final pode ser conferido na própria Clicksign.
3. Instabilidade: a Clicksign reenvia o aviso conforme a política dela; acompanhe nos Logs.

## Quando escalar
Se as permissões estão corretas, o registro existe e o erro se repete. Anexe: `traceKey`, `código de erro: clicksign.event.bitrix_update_failed`, domínio, `documentKey` e o `err`.
