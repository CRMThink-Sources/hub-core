# Proposal

## Why

O status e o período das assinaturas Stripe na SPA 1142 dependem só do webhook do gateway. Hoje nada corrige a SPA quando um evento se perde (entrega falha, API fora do ar no momento, assinatura editada à mão no CRM). Nesses casos, uma assinatura cancelada no Stripe segue `Ativo` na SPA e as linhas dela continuam habilitadas e cobradas de nós no provider; ou uma renovação paga não chega, e o cliente fica com a linha bloqueada. A verificação de assinaturas (change `verificacao-completa-assinaturas`) deixou o Stripe de fora de propósito, para este job cuidar.

## What Changes

- Novo job **Sincronização Stripe**, a cada hora no minuto 30, com lock próprio. Para cada assinatura da SPA 1142 com modalidade `stripe`, id do gateway e ambiente igual ao da chave Stripe em uso (campo de ambiente vazio conta como produção), ele lê a assinatura no Stripe e aplica na SPA o que o webhook aplicaria:
  - status pelo mesmo mapa do webhook (`trialing`/`active` → `Ativo`; `past_due`/`unpaid`/`incomplete`/`incomplete_expired`/`paused` → `Vencido`) e início/fim do período;
  - Stripe `canceled` → grava `Cancelado` e desassina as linhas no Z-API/HubMessage, como o `subscription.deleted` do webhook;
  - status do Stripe fora do mapa → nada é gravado, a rodada registra;
  - assinatura não encontrada no Stripe → nada é gravado, a rodada registra como falha para revisão manual.
- Assinaturas que já concordam com o Stripe não são escritas, como no webhook.
- Desligado onde a chave Stripe não é de produção ou os efeitos de provider estão desligados (homologação); a flag `STRIPE_SYNC_ENABLED` liga ou desliga explicitamente.
- Histórico de rodadas próprio (rodadas e ações por assinatura, 90 dias), API do portal para listar, detalhar e "Rodar agora".
- Backoffice: segundo job no catálogo, com página de detalhe e "Rodar agora". Aparece também na saúde dos jobs da home.
- O webhook passa a usar o mesmo código de aplicação de estado que o job (sem mudança de comportamento).

## Capabilities

### New Capabilities
- `pagamentos/sincronizacao-stripe`: o job de reconciliação Stripe → SPA 1142, o que ele grava e quando, o histórico de rodadas e a página do backoffice.

### Modified Capabilities
- `portal-admin/catalogo-jobs`: o catálogo passa a ter dois jobs (verificação de assinaturas e sincronização Stripe).

## Impact

- **API:**
  - `modules/thinkzap/application/handle-gateway-webhook-event.ts`: extração da aplicação de estado para uso comum, que devolve o que fez em cada assinatura;
  - `modules/thinkzap/infra/gateway/stripe-payment.gateway.ts`: leitura de estado com o mapa de decisão e "não encontrada" distinta;
  - lister da SPA 1142 por modalidade/ambiente;
  - novo caso de uso, repositório, lock e job em `shared/infra/scheduler`;
  - rotas do portal `/portal/stripe-sync/runs`.
- **Banco:** migration com duas tabelas novas (`core_stripe_sync_runs`, `core_stripe_sync_changes`). Aditiva.
- **Front:** registro de jobs, página de detalhe do job novo, i18n `admin/jobs`.
- **Stripe:** uma leitura (`subscriptions.retrieve`) por id de gateway por hora — dezenas de chamadas, longe do limite de leitura.
- **Dados:** 14 assinaturas Stripe hoje têm o ambiente vazio na SPA e entram como produção; as 12 marcadas `homolog` ficam de fora.
