# Design

## Context

O motivo está em proposal.md, seção Why. O que já existe e pode ser reaproveitado:

- **Gatilho pronto.** O controller (`dispatchSubscriptionEffect`) já transforma o UPDATE da SPA 1142 no job `sync-subscription-billing`. Esse job roda sob a guarda de `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED`. O caso de uso `SyncSubscriptionLinesBilling` lista os itens com uma leitura crua (`SubscriptionItemIdLister`) e roda `SyncSpaItemResourceStatus` para cada um, coletando as falhas e lançando no fim.
- **Regra única.** `resolveProviderBillingAction({ itemStatus, parentStatus, mirror })` decide `subscribe | unsubscribe | noop`. Hoje `unsubscribe` só acontece para item `cancelled`. Com o pai `cancelled`, o resultado é `noop` (`parent-inactive`).
- **Leitura do pai é preguiçosa.** `SyncSpaItemResourceStatus` só lê o status do pai (`SubscriptionStatusReader`, sem cache) quando o item está `active` e sem `subscribedAt`. É justamente o item já assinado, o que precisa ser desassinado, que hoje nunca consulta o pai.
- **Marcas.** `setBillingState(itemId, 'subscribed' | 'unsubscribed')` grava uma marca e apaga a outra. A reativação já funciona: item `active` com `unsubscribedAt` e pai `active` dá `subscribe`.
- **Providers.**
  - Z-API: `ZApiClient.unsubscribe` faz `POST /integrator/on-demand/cancel` e lança `thinkzap.zapi.instance_subscribe_failed`, que é o código errado.
  - HubMessage: `cancelChannel` faz `DELETE /v1/channels/:id/cancel` com `cancelReason`.
  - Nenhum dos dois trata como sucesso o cancelamento de um recurso já cancelado.
- **Stripe.** `HandleGatewayWebhookEvent.applyCancellation` grava `cancelled` na 1142 e chama `providerBilling.unsubscribe(item)`, que marca o espelho. A própria escrita na 1142 dispara o UPDATE que chega ao fan-out.

## Goals / Non-Goals

**Goals:**
- Uma única regra de cobrança decide desassinar por pai cancelado. Nada de caminho paralelo só para a 1142.
- Desassinar continua idempotente frente a UPDATEs repetidos e a retries.
- O UPDATE do item (1146) não ganha leitura extra do Bitrix.

**Non-Goals:**
- Desconectar a sessão ou apagar a instância/canal. `unsubscribe` agenda o fim da cobrança e permite reativar sem QR novo.
- Mudar o status dos itens 1146 ou a quantidade cobrada.
- Reagir a `past_due` (decidido com o usuário: só `cancelled`).
- Reconciliar em lote assinaturas canceladas antes deste deploy. Elas só são desassinadas no próximo UPDATE da 1142 (veja Open Questions).

## Decisions

### 1. Pai `cancelled` vira `unsubscribe` dentro de `resolveProviderBillingAction`
- **Decisão:** um ramo novo, avaliado antes dos ramos de assinatura:
  ```
  pai cancelled, sem marca de desassinado        → unsubscribe (reason: parent-cancelled)
  item cancelled, sem marca de desassinado       → unsubscribe (como hoje)
  item active, pai active não trial, sem marca   → subscribe   (como hoje)
  qualquer outro                                 → noop
  ```
  O ramo não olha `subscribedAt`. Linhas Stripe anteriores à marca e linhas manuais assinadas fora do produto não têm `subscribedAt`, e exigir a marca deixaria essas linhas cobradas para sempre. O custo é cancelar recurso que talvez nunca tenha sido assinado (trial cancelado, manual nunca ativada), e isso é absorvido pela decisão 4.
- `parent-inactive` passa a cobrir só `past_due`.
- O `unsubscribe` ganha um campo `reason` (`item-cancelled | parent-cancelled`). O caso de uso usa esse campo para escolher a origem e a mensagem de log.
- **Alternativa descartada:** um caso de uso novo só para a desassinatura em massa. Seriam duas regras sobre o mesmo recurso e as mesmas marcas, que é o que `SyncSubscriptionLinesBilling` evita de propósito.

### 2. O fan-out lê o status do pai uma vez e repassa para cada item
- **Decisão:**
  - `SyncSpaItemResourceStatusInput` ganha `parentStatus?: Subscription['status'] | null`.
  - Se o campo for passado, o caso de uso usa esse valor e não lê o pai.
  - Se estiver ausente (UPDATE do item), mantém a leitura preguiçosa de hoje.
  - `SyncSubscriptionLinesBilling` recebe o `SubscriptionStatusReader`, lê o status uma vez antes do loop e repassa para os itens.
- **Por quê:** é o fan-out que sabe que a assinatura mudou. Ler o pai a cada UPDATE de item já assinado adicionaria uma ida ao Bitrix a cada edição de campo, e a maioria dessas edições são escritas da própria API. Quando a assinatura é cancelada, o fan-out passa por todos os itens de qualquer forma. Também deixa de reler a mesma assinatura N vezes, o que o comentário atual aceita como custo.
- **Consequência:** no UPDATE do item, uma linha assinada sob pai cancelado não é desassinada. Isso é aceitável porque o UPDATE da 1142 sempre acontece quando o status muda, e o retry da fila cobre falhas. No UPDATE do item, uma linha `active` sem `subscribedAt` lê o pai como hoje e, se ele estiver `cancelled`, também é desassinada, pela mesma regra.
- **Pai ilegível no fan-out (`null`):** é repassado como `null`, e cada item cai em `parent-missing`, como hoje. Nada é desassinado.

### 3. Origem `subscription-cancelled` em `ProviderResourceBilling`
- **Decisão:** nova `ProviderBillingOrigin` com o motivo `'Assinatura cancelada no CRM'`, enviado no `cancelReason` da HubMessage. `SyncSpaItemResourceStatus` usa essa origem quando `reason === 'parent-cancelled'`, mantém `spa-item-status` para item cancelado e continua com `propagate: true`.
- Atualizar o comentário de topo, que hoje diz "o cancelamento do contrato manual continua fora daqui".
- **Por quê:** o motivo é o que permite rastrear o cancelamento do lado do provider. "Linha cancelada" seria falso nesse caso.

### 4. Cancelamento idempotente nos clients
- **Decisão:** validar em sandbox o que a Z-API (`/integrator/on-demand/cancel`) e a HubMessage (`DELETE /v1/channels/:id/cancel`) respondem em dois casos: recurso já cancelado e recurso nunca assinado (trial).
  - Se a resposta for um erro identificável, cada client ganha um predicado (`isZApiAlreadyCancelled`, `isHubMessageAlreadyCancelled`) que trata o caso como sucesso. Mesmo padrão de `isZApiAlreadySubscribed`/`isHubMessageAlreadyPaid`.
  - O `ZApiClient.unsubscribe` passa a lançar `thinkzap.zapi.instance_unsubscribe_failed`, que é um código novo no catálogo.
- **Por quê:** a decisão 1 aceita cancelar sem a marca `subscribedAt`. Na Stripe, o gateway e o fan-out podem correr juntos antes de qualquer marca. E o cancelamento manual pode já ter sido feito pela automação externa. Sem idempotência, cada um desses casos vira um job em retry até esgotar as tentativas, com log `error` falso.
- **Se a resposta não for identificável** (erro genérico 4xx/5xx), o predicado não é criado. O item falha, e o retry esgota as tentativas, com o log apontando o item. Isso fica registrado como risco.
- **Resultado da validação (2026-10-13):**
  - **Z-API:** o cancel responde `200` com `{ due, id, token }`, em que `due` é o fim do período pago em epoch ms. Não há erro de "já cancelado", então nenhum predicado foi necessário.
  - **HubMessage:** responde `204`, mas **só cancela com a query `cancel=true`**, que o client não enviava. Foi corrigido em `cancelChannel`. Até esse deploy, nenhum cancelamento de canal tinha efeito: gateway Stripe, item cancelado e exclusão. Não há erro de "já cancelado", então nenhum predicado foi necessário.
  - Os dois cancelamentos são seguros de repetir, e o ajuste local da regra previsto em Risks não é necessário.

### 5. Contagem e log do fan-out
`SyncSubscriptionLinesBillingResult` ganha `unsubscribed`. O log em `info` passa a sair quando `subscribed + unsubscribed > 0`. Continua `debug` quando nada mudou, porque o UPDATE da 1142 é ruidoso.

## Risks / Trade-offs

- **[Assinatura cancelada por engano no CRM]** → todas as linhas são desassinadas. Mitigação: `unsubscribe` só agenda o corte para o fim do período. Voltar para `Ativo` reassina as linhas `active` sem QR novo. Avisar o time de suporte.
- **[Automação externa que hoje cancela contrato manual]** → as duas desassinam o mesmo recurso. Mitigação: a idempotência da decisão 4. Depois do deploy, a automação externa pode ser desligada.
- **[Cancel de recurso nunca assinado não é idempotente no provider]** → o job de uma assinatura trial cancelada retenta até esgotar. Mitigação: a validação em sandbox vem antes do deploy (tarefa 1). Se não houver código identificável, o próximo passo é exigir `subscribedAt` ou pai não trial para esse provider, como ajuste local da regra.
- **[Linha assinada sob pai cancelado sem UPDATE da 1142]** (por exemplo, o job esgotou as tentativas) → continua cobrada. Mitigação: o log `error` com `failedItemIds`. Qualquer nova edição da 1142 reprocessa.
- **[Corrida com o gateway Stripe]** → dois cancelamentos simultâneos no mesmo recurso. Mitigação: idempotência (decisão 4). A marca final é a mesma nos dois caminhos.

## Migration Plan

1. Validar em sandbox as respostas de cancelamento da Z-API e da HubMessage (decisão 4) e implementar os predicados.
2. Deploy em staging (flag `false`) e confirmar que o UPDATE da 1142 continua sem enfileirar efeito.
3. Deploy em produção. Testar cancelando uma assinatura manual de teste com uma linha de cada provider e conferir o log `info` e o painel de cada provider. Reativar e conferir que a linha é assinada de novo.
4. Rollback: reverter o código. As marcas `unsubscribedAt` gravadas continuam válidas, e a regra antiga as lê sem problema.

## Open Questions

- Existem assinaturas manuais já `cancelled` com linhas ainda cobradas no provider? Se existirem, basta uma edição qualquer na 1142 de cada uma, ou um script pontual que enfileire `sync-subscription-billing` para elas. Isso não muda a regra nem as tarefas principais.
