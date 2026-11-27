-- Listagem da aba Envios do ThinkZap: filtra pela instalacao, opcionalmente por quem
-- enviou, e ordena/filtra por data. Sem estes indices a consulta varre o outbox todo.
--
-- Aditiva: so CREATE INDEX, sem alterar coluna nem dado.

-- CreateIndex
CREATE INDEX `core_thinkerszap_widget_outbox_domain_id_created_at_idx` ON `core_thinkerszap_widget_outbox`(`domain_id`, `created_at`);

-- CreateIndex
CREATE INDEX `core_thinkerszap_widget_outbox_domain_id_operator_bitrix_use_idx` ON `core_thinkerszap_widget_outbox`(`domain_id`, `operator_bitrix_user_id`, `created_at`);
