-- Indice para a busca de "conversa existente" do espelhamento de mensagens enviadas
-- pelo aparelho (celular/WhatsApp Web): row mais recente de (instance_id, chat_id) com
-- bitrix_chat_id gravado. Sem ele a consulta varre todas as mensagens da instancia.
--
-- So indice, sem coluna nem backfill. Pode subir antes do deploy da aplicacao.
CREATE INDEX `core_thinkerszap_messages_instance_id_chat_id_idx` ON `core_thinkerszap_messages`(`instance_id`, `chat_id`);
