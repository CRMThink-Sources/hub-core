-- CreateTable
CREATE TABLE `core_thinkerszap_messages` (
    `id` VARCHAR(191) NOT NULL,
    `instance_id` VARCHAR(191) NOT NULL,
    `source` ENUM('ZAPI', 'BITRIX') NOT NULL,
    `z_api_message_id` VARCHAR(191) NULL,
    `bitrix_message_id` VARCHAR(191) NULL,
    `type` ENUM('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT') NOT NULL,
    `text` TEXT NULL,
    `file_name` VARCHAR(191) NULL,
    `chat_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `core_thinkerszap_messages_instance_id_idx`(`instance_id`),
    UNIQUE INDEX `core_thinkerszap_messages_instance_id_z_api_message_id_key`(`instance_id`, `z_api_message_id`),
    UNIQUE INDEX `core_thinkerszap_messages_instance_id_bitrix_message_id_key`(`instance_id`, `bitrix_message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `core_thinkerszap_messages` ADD CONSTRAINT `core_thinkerszap_messages_instance_id_fkey` FOREIGN KEY (`instance_id`) REFERENCES `core_thinkerszap_instances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
