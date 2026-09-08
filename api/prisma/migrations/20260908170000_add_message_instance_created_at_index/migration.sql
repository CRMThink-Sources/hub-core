-- Substitui o indice simples em `instance_id` por um composto com `created_at`.
--
-- Cobre os dois usos: lookup por instancia (prefixo esquerdo do composto, mesmo
-- comportamento de antes) e a contagem por periodo da home de estatisticas
-- (`thinkzap-home-message-stats`), que filtra `instance_id IN (...) AND
-- created_at BETWEEN ...` — sem a coluna de data no indice, esse filtro faz scan.
--
-- Aditiva/sem perda: so troca indice, nenhuma coluna ou dado muda.
DROP INDEX `core_thinkerszap_messages_instance_id_idx` ON `core_thinkerszap_messages`;

-- CreateIndex
CREATE INDEX `core_thinkerszap_messages_instance_id_created_at_idx` ON `core_thinkerszap_messages`(`instance_id`, `created_at`);
