---
category: integration
audience: suporte
summary: Observabilidade — o vínculo de cobrança de uma linha com o provedor externo falhou; o serviço do cliente segue.
---
# thinkzap.subscription.provider_billing_failed

## O que significa
Caso de reconciliação de cobrança. O vínculo de cobrança de uma linha com o provedor externo (gateway de pagamento) falhou. O **serviço do cliente continua funcionando normalmente** — a linha segue ativa; o que ficou pendente é o acerto de cobrança do lado do provedor. Não há impacto imediato para o cliente.

## Causa provável
- **Falha na integração com o provedor externo**: o gateway de pagamento não aceitou ou não respondeu ao vínculo de cobrança.
- **Dados de cobrança inconsistentes**: o item/linha ficou sem o vínculo de cobrança concluído no provedor.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.provider_billing_failed`.
3. Leia na linha do log o item/linha e o provedor envolvidos — são a referência para a reconciliação.

## Como resolver
1. Como o serviço do cliente não está afetado, não é preciso ação urgente no atendimento.
2. Encaminhe ao suporte/desenvolvimento os dados do log (item/linha e provedor) para **reconciliar a cobrança com o provedor externo**.
3. Não há nova cobrança a fazer com o cliente por conta deste evento; é um acerto interno com o provedor.

## Quando escalar
Encaminhe à equipe de desenvolvimento para a reconciliação da cobrança. Anexe: `traceKey`, `código de erro: thinkzap.subscription.provider_billing_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e os ids do item/linha e do provedor.
