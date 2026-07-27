-- AlterTable
ALTER TABLE `core_thinkerszap_connectors` ADD COLUMN `provider` ENUM('ZAPI', 'HUBMESSAGE') NOT NULL DEFAULT 'ZAPI';

-- AlterTable
ALTER TABLE `core_thinkerszap_instances` ADD COLUMN `channel_id` VARCHAR(191) NULL,
    ADD COLUMN `phone_id` VARCHAR(191) NULL,
    ADD COLUMN `waba_id` VARCHAR(191) NULL,
    ADD COLUMN `webhook_id` VARCHAR(191) NULL;
