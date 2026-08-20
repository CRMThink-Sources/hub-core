---
category: internal
audience: dev
summary: Observabilidade — linha criada à mão e a cobrança do contrato não foi ajustada; cliente com uma linha a mais do que paga.
---
# thinkzap.subscription.manual_line_billing_not_adjusted

## O que significa
A linha criada à mão **funciona** — o recurso existe no provedor e a credencial está no item —, e o ajuste da cobrança no gateway não aconteceu. O cliente tem uma linha a mais do que paga.

Não há impacto para o cliente, e é justamente isso que torna o caso perigoso: é perda silenciosa, que ninguém abre chamado por. Este log é o único lugar onde ela aparece.

## Causa provável
Lida no campo `reason` da linha do log:

- `sync-failed` — o gateway recusou ou não respondeu ao ajuste dos `line_items`.
- `plan-for-provider-missing` — um conector presente no contrato não tem plano ativo com price id na SPA de planos. É configuração de catálogo ausente, não falha do cliente.
- `plan-for-provider-ambiguous` — o conector tem mais de um plano ofertável, então não há como saber qual precifica a linha que já existe. O job **recusa** em vez de escolher: escolher cobraria o preço de um plano pelo uso de outro, em silêncio.
- `gateway-not-configured` — a assinatura declara modalidade do gateway e o ambiente não tem a chave dele. É configuração incompleta nossa, não estado do cliente; confira as variáveis do gateway no ambiente onde o worker roda.

## Como verificar
1. Na tela de Logs, filtre pelo `traceKey` do job.
2. Confirme `código de erro: thinkzap.subscription.manual_line_billing_not_adjusted`.
3. Leia `subscriptionItemId`, `gatewaySubscriptionId` e `reason`.
4. No gateway, abra a assinatura `gatewaySubscriptionId` e compare a soma das quantidades dos `line_items` com o número de linhas ativas do contrato na SPA.

## Como resolver
1. Em `plan-for-provider-ambiguous` ou `plan-for-provider-missing`, arrume o catálogo primeiro: garanta **um** plano ativo com price id por conector na SPA de planos. Sem isso, qualquer ajuste seguinte recusa igual.
2. Ajuste a quantidade do `line_item` no gateway para o número de linhas ativas do contrato. A SPA é a fonte de verdade do que existe; o gateway é onde isso é cobrado — nunca o contrário.
3. Confirme que a próxima fatura reflete a quantidade certa.

## Nota sobre assinatura que não é do gateway
Se a assinatura pai tem modalidade `manual` (boleto), este código **não** é emitido: por decisão de produto, o job só provisiona e a cobrança é responsabilidade da integração de fora. O caso aparece no log em nível `info`, não como erro.

## Quando escalar
Escale ao desenvolvimento quando o `reason` for `sync-failed` recorrente, ou quando o catálogo estiver correto e o ajuste continuar recusando. Anexe: `traceKey`, código de erro, id do item na SPA 1146, `gatewaySubscriptionId`, `reason` e horário.
