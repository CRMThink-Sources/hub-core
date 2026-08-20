-- Remove a cobranca antiga (Stripe + tela de financeiro) do schema.
--
-- DESTRUTIVA E IRREVERSIVEL. `billing_subscriptions` guarda o vinculo entre a
-- instalacao e a assinatura no Stripe (`stripe_subscription_id`, quantidade de
-- conectores, fim de trial) dos clientes vivos. Depois deste drop esse mapa
-- existe apenas no Stripe: a reconciliacao passa a depender da API deles.
--
-- Confirmado com o usuario: a cobranca sera modelada do zero e o dado atual nao
-- sera migrado. Rodar so no deploy que sobe o codigo sem os leitores -- aplicar
-- antes derruba o handler de webhook e o gate de assinatura da sessao.
--
-- Ordem obrigatoria: `billing_subscriptions` referencia `billing_plans`, e as
-- duas referenciam `core_apps`/`core_app_codes`. Filha primeiro, senao a FK
-- bloqueia o drop.

DROP TABLE IF EXISTS `billing_subscriptions`;
DROP TABLE IF EXISTS `billing_plans`;
