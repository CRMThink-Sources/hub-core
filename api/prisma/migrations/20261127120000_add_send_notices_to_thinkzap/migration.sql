-- Aviso de envio do ThinkZap: recusa informada pelo provider depois do aceite, e o
-- registro do comentario de status no CRM e da notificacao a quem enviou.
--
-- Aditiva: colunas nulas, indices e tabela nova, sem backfill e sem chave
-- estrangeira. Pode subir antes do deploy da aplicacao.

-- AlterTable
ALTER TABLE `core_thinkerszap_widget_outbox` ADD COLUMN `send_notice_id` VARCHAR(191) NULL,
    ADD COLUMN `rejected_at` DATETIME(3) NULL,
    ADD COLUMN `failure_code` VARCHAR(191) NULL,
    ADD COLUMN `failure_reason` TEXT NULL;

-- Busca da row pelo id de mensagem do provider, que e o que o webhook de status traz.
-- CreateIndex
CREATE INDEX `core_thinkerszap_widget_outbox_instance_id_provider_message__idx` ON `core_thinkerszap_widget_outbox`(`instance_id`, `provider_message_id`);

-- CreateIndex
CREATE INDEX `core_thinkerszap_widget_outbox_send_notice_id_idx` ON `core_thinkerszap_widget_outbox`(`send_notice_id`);

-- CreateTable
CREATE TABLE `core_thinkerszap_send_notices` (
    `id` VARCHAR(191) NOT NULL,
    `dispatch_key` VARCHAR(191) NOT NULL,
    `domain_id` VARCHAR(191) NOT NULL,
    `app_code` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `operator_bitrix_user_id` VARCHAR(191) NULL,
    `eager` BOOLEAN NOT NULL DEFAULT false,
    `comment_id` VARCHAR(191) NULL,
    `comment_as_author` BOOLEAN NOT NULL DEFAULT false,
    `comment_claimed_at` DATETIME(3) NULL,
    `from_phone` VARCHAR(191) NULL,
    `alerted_failures` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `core_thinkerszap_send_notices_dispatch_key_key`(`dispatch_key`),
    INDEX `core_thinkerszap_send_notices_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
