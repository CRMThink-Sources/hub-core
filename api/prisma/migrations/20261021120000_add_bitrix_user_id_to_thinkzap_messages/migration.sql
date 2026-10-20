-- Autor no Bitrix de cada mensagem: o operador que respondeu (row BITRIX) ou o operador
-- como quem a copia espelhada do aparelho foi postada (row ZAPI). E o que permite postar
-- a mensagem enviada pelo aparelho como o operador da sessao, e editar/apagar com o mesmo
-- autor.
--
-- Coluna nullable, sem backfill: row antiga sem operador so leva o espelhamento ao
-- fallback (postar como o contato). Pode subir antes do deploy da aplicacao.
ALTER TABLE `core_thinkerszap_messages` ADD COLUMN `bitrix_user_id` VARCHAR(191) NULL;

-- Busca do operador da sessao: row BITRIX mais recente do chat do canal aberto.
CREATE INDEX `core_thinkerszap_messages_bitrix_chat_id_created_at_idx` ON `core_thinkerszap_messages`(`bitrix_chat_id`, `created_at`);
