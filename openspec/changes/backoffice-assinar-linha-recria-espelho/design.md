# Design

## Context

Ver `proposal.md` (Why). Estado atual observado:

- `subscribeThinkzapLine` e `unsubscribeThinkzapLine` (`modules/portal/application`) resolvem o item, chamam o provider (Z-API `subscribe`/`unsubscribe`, HubMessage `subscribeChannel`/`cancelChannel`) e terminam em `effects.mirrors.setBillingState(item.id, estado)`. O tipo `LineBillingEffects.mirrors` expõe só `setBillingState`.
- `RedisSpaItemResourceMirrorRepository.setBillingState` lê o espelho; se não existe, loga `debug` e retorna sem criar nada (de propósito: o repositório não tem a credencial para criá-lo). O espelho não tem TTL e é apagado pela exclusão da linha.
- O sync automático (`SyncSpaItemResourceStatus`) resolve isso com `ensureMirror`: grava `{provider, instanceId, zApiToken?, channelId?, subscriptionId}` quando o espelho falta, **depois** de a chamada ao provider dar certo e antes da marca. Esse método é privado da classe.
- `SubscriptionItem` traz o que o espelho exige: `subscription` (id da assinatura pai) e `metadata` com `zApiInstanceId`/`zApiInstanceToken` ou `hubmessageChannelId`.
- O front (`admin-app-subscriptions-section.tsx`, `lineAction`) faz `POST .../thinkzap-lines/:id/(subscribe|unsubscribe)` e ignora o corpo da resposta, que hoje é `{ message: 'Subscribed' }`.

## Goals / Non-Goals

**Goals**
- A ação manual nunca devolve sucesso com a marca perdida em silêncio.
- A recriação do espelho usa a mesma regra do sync automático, sem duas cópias.

**Non-Goals**
- Não mudar a regra de trial do ciclo automático (pai `trialing` continua sem assinar nem marcar).
- Não recriar espelhos em massa nem criar backfill: o caso conhecido (item 317) se resolve com um novo clique depois do deploy.
- Não investigar por que a exclusão apaga o espelho de uma linha que depois volta a operar (ver Open Questions).
- Não mexer na ação em lote `subscribe-lines` da assinatura, salvo se a verificação da tarefa 1.3 mostrar a mesma falha.

## Decisions

1. **Extrair `ensureMirror` para um helper compartilhado**, em `modules/thinkzap/application/helpers/ensure-line-mirror.ts`, usado pelo sync e pelas duas ações do portal. Recebe `(mirrors, itemId, resource, subscriptionId)` e devolve `'present' | 'created' | 'no-parent'`. Alternativa descartada: duplicar o corpo no portal, que é o mesmo risco que `save-resource-mirror.ts` já documenta (shapes divergentes entre fluxos).
2. **Ordem: provider, espelho, marca.** O espelho só é criado depois de o provider aceitar, para não deixar um espelho sem marca (indistinguível de recurso assinado se a chamada falhasse). É a ordem já usada no sync.
3. **`LineBillingEffects.mirrors` passa a `Pick<..., 'find' | 'save' | 'setBillingState'>`.** Os testes atuais já injetam o efeito, então o impacto é nos mocks.
4. **Sem assinatura pai, não inventa espelho**: o helper devolve `no-parent`, loga `warn` e a ação segue; a resposta diz `markRecorded: false`.
5. **Resposta com `markRecorded: boolean`** além do `message` atual. Mudança aditiva: o front antigo continua funcionando. Quando `false`, o front mostra aviso em vez do sucesso verde.
6. **Chave do espelho por item.** Em linha compartilhada por dois itens (mesma credencial), cada item tem o seu espelho; nada muda aqui.

## Risks / Trade-offs

- [O espelho recriado fica sem marcas antigas] → aceitável: as marcas só têm sentido para o recurso atual, e a ação manual grava a nova em seguida.
- [Recriar espelho de linha que o cliente excluiu de propósito] → a ação exige o item existir na SPA (`resolveAdminLine`); linha apagada na SPA não chega aqui.
- [Refatorar o `ensureMirror` do sync pode alterar o ciclo automático] → o helper mantém o comportamento (inclusive o `warn` sem assinatura pai); os testes do sync cobrem.
- [`markRecorded: false` pode assustar o suporte] → o texto do front diz o que fazer (verificar o item na SPA, que está sem assinatura pai).

## Migration Plan

Sem migration nem env. Deploy normal (develop → staging → master). Depois do deploy em produção, pedir ao suporte para clicar em "assinar" no item 317 e conferir `providerBilling: subscribed` em `/api/portal/apps/:appId/subscriptions`. Rollback: reverter o commit; espelhos criados continuam válidos.

## Open Questions

- Por que o espelho do 317 não foi recriado quando a linha voltou a operar depois das exclusões de 24/11 (12:23 e 12:36), e por que o 409 teve o dele recriado no mesmo período? Não bloqueia esta change, mas pode pedir outra: o provisionamento de linha que volta a operar deveria sempre gravar o espelho.
- A assinatura 239 deveria estar `trialing`? Se o cliente já paga, o status na SPA 1142 precisa ir para `active` para o ciclo automático assinar e marcar. Decisão do suporte/negócio, fora do código.
- O log do 317 mostra a assinatura 189 nas exclusões e o portal a 239. Confirmar qual é a pai real antes de gravar o espelho em produção (a ação usa `item.subscription` da SPA).
