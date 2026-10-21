-- Outbox como caminho unico de envio da linha Z-API (cadenciador de mensagens):
-- origem do envio, partes de midia agrupadas, contexto do canal aberto para operador e
-- bot, e a posicao na fila FIFO da linha.
--
-- Aditiva: tudo nullable, `origin` com default `WIDGET` (o que toda row antiga e do
-- ponto de vista do dispatcher) e `kind` ganha `MEDIA` no fim do ENUM. Pode subir antes
-- do deploy da aplicacao.
-- AlterTable
ALTER TABLE `core_thinkerszap_widget_outbox` ADD COLUMN `bitrix_chat_id` VARCHAR(191) NULL,
    ADD COLUMN `bitrix_message_id` VARCHAR(191) NULL,
    ADD COLUMN `cadence_wait_until` DATETIME(3) NULL,
    ADD COLUMN `caption` TEXT NULL,
    ADD COLUMN `dispatch_group_id` VARCHAR(191) NULL,
    ADD COLUMN `dispatch_meta` JSON NULL,
    ADD COLUMN `file_name` VARCHAR(191) NULL,
    ADD COLUMN `media_source` JSON NULL,
    ADD COLUMN `media_type` VARCHAR(191) NULL,
    ADD COLUMN `origin` ENUM('WIDGET', 'WIDGET_ATTACHMENT', 'ROBOT_MESSAGE', 'ROBOT_BUTTONS', 'ROBOT_TEMPLATE', 'SMS_CAMPAIGN', 'OPERATOR', 'BOT') NOT NULL DEFAULT 'WIDGET',
    ADD COLUMN `origin_context` JSON NULL,
    ADD COLUMN `part_index` INTEGER NULL,
    ADD COLUMN `queue_seq` INTEGER NULL,
    MODIFY `kind` ENUM('TEXT', 'TEMPLATE', 'INTERACTIVE_BUTTON', 'MEDIA') NOT NULL DEFAULT 'TEXT';

-- CreateIndex
CREATE INDEX `core_thinkerszap_widget_outbox_dispatch_group_id_idx` ON `core_thinkerszap_widget_outbox`(`dispatch_group_id`);


