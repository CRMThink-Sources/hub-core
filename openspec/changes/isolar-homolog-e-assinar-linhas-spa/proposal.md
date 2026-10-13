# Proposal

## Why

Produção e homolog usam o **mesmo portal Bitrix**. O portal tem dois "Webhooks de saída", um para cada API. Por isso, todo evento da SPA 1146 (item de assinatura) é processado duas vezes:

- **ADD**: as duas APIs provisionam. A única proteção é "o item já tem credencial", e essa checagem acontece depois da leitura. As duas leem antes de qualquer uma gravar, então nascem duas instâncias Z-API ou dois canais HubMessage, e um deles fica órfão e cobrado de nós.
- **UPDATE e DELETE**: homolog também assina, desassina e desconecta recursos que pertencem a clientes de produção.

Além disso, o produto só **assina** o recurso no provider (Z-API `subscription` / HubMessage `subscribe`) quando a assinatura é paga pelo Stripe, no checkout ou numa linha adicional. A assinatura manual (boleto), criada pelo time no CRM, deixa as linhas provisionadas e funcionando sem nunca serem assinadas no provider. A Z-API e a HubMessage tratam um recurso não assinado como trial ou avulso, o que pode levar ao bloqueio da instância.

## What Changes

- **Isolamento de homolog**: uma nova flag de ambiente desliga todos os efeitos da SPA 1146 sobre o provider (ADD → provisionar, UPDATE → sincronizar status, DELETE → limpar). A flag fica **desligada no staging/homolog** e **ligada em produção**, que é o padrão.
  - O webhook continua respondendo 200 e invalidando cache nos dois ambientes.
  - Só deixa de enfileirar os jobs que tocam o provider.
  - A recusa é registrada em log `debug`, com o motivo.
- **Assinar ao ativar a assinatura (UPDATE da SPA 1146)**: o job de sincronização de status do item passa a **assinar** o recurso quando todas estas condições valem:
  - o item está `active` e tem credencial;
  - a assinatura pai (SPA 1142) está `active` e não é trial (`trialing`/`trial_expired`);
  - o espelho do recurso ainda não tem a marca de assinado.
  - Vale para as modalidades `manual` e `stripe`.
- **Assinar ao ativar a assinatura (UPDATE da SPA 1142)**: o webhook passa a reagir ao UPDATE da SPA 1142. Um novo job percorre os itens da assinatura e aplica a mesma regra a cada um. Isso cobre o caso comum: os itens são criados antes de a assinatura virar ativa.
- **Marca de assinado no espelho (`subscribedAt`)**: é gravada depois de cada subscribe bem-sucedido, em todos os caminhos (checkout Stripe, linha adicional, provisionamento via SPA e os novos gatilhos). É limpa quando o recurso é desassinado. Com ela, os UPDATEs repetidos (inclusive os gerados pela própria API) não assinam de novo.
- O provisionamento a partir do ADD da SPA 1146 continua igual: provisiona, e só assina na hora se o pai for Stripe pago. Para pai manual, a assinatura passa a vir pelos gatilhos de UPDATE acima.

## Capabilities

### New Capabilities
- `thinkzap/ciclo-provider-spa-assinatura`: como os eventos da SPA 1146 (item de assinatura) e da SPA 1142 (assinatura) controlam o recurso no provider (provisionar, assinar, desassinar, limpar), incluindo o isolamento entre produção e homolog e a idempotência da assinatura.

### Modified Capabilities
<!-- Nenhuma: nenhum spec existente cobre webhook de SPA ou cobrança no provider. -->

## Impact

- **API, webhook**: `api/src/modules/application/presentation/controllers/spa-webhook.controller.ts`. Muda o `dispatchItemEffect` (guarda de ambiente) e entra um novo despacho para o UPDATE da 1142. Também `make-spa-webhook-controller.ts`.
- **Config**: `api/src/config/env.ts` (nova flag), `api/.env.staging`, `api/.env.prod`, `docker-compose.staging.yml`, `DEPLOY.md`.
- **Jobs**:
  - `sync-spa-item-resource-status.ts` ganha o ramo de assinatura.
  - Novo caso de uso e job para a fan-out por assinatura em `spa-item-resource-sync.queue.ts` / `.processor.ts`.
- **Espelho**: `spa-item-resource-mirror.repository.ts` e a implementação Redis (marca `subscribedAt`).
- **Chamadores de subscribe**: `activate-line-subscription.ts`, `create-additional-line.ts`, `provision-line-from-spa-item.ts` e `provider-resource-billing.ts` passam a gravar a marca.
- **Operação**: as linhas manuais já ativas em produção vão ser assinadas no primeiro UPDATE que receberem depois do deploy, o que é desejado. Linhas Stripe já assinadas, mas ainda sem marca, recebem um subscribe repetido. O provider precisa tolerar isso (ver design).
