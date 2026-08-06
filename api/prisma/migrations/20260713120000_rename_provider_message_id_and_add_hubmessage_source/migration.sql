-- Rename z_api_message_id -> provider_message_id preservando os dados.
-- CHANGE COLUMN (e nao DROP/ADD) para nao perder os ids de mensagem ja gravados.
ALTER TABLE `core_thinkerszap_messages`
    CHANGE COLUMN `z_api_message_id` `provider_message_id` VARCHAR(191) NULL;

-- RenameIndex
ALTER TABLE `core_thinkerszap_messages`
    RENAME INDEX `core_thinkerszap_messages_instance_id_z_api_message_id_key`
    TO `core_thinkerszap_messages_instance_id_provider_message_id_key`;

-- AlterTable
ALTER TABLE `core_thinkerszap_messages`
    MODIFY `source` ENUM('ZAPI', 'BITRIX', 'HUBMESSAGE') NOT NULL;
