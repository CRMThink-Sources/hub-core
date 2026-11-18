-- CreateTable
CREATE TABLE `thinkzap_insights_settings` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `vibecode_key_enc` TEXT NULL,
    `vibecode_key_last4` VARCHAR(4) NULL,
    `vibecode_portal_id` VARCHAR(191) NULL,
    `vibecode_validated_at` DATETIME(3) NULL,
    `config` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `thinkzap_insights_settings_app_id_key`(`app_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thinkzap_insights_settings` ADD CONSTRAINT `thinkzap_insights_settings_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
