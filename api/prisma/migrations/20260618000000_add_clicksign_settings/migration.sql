-- CreateTable
CREATE TABLE `core_clicksign_settings` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `fields` JSON NULL,
    `verify_settings` JSON NULL,
    `contact_settings` JSON NULL,
    `deal_settings` JSON NULL,
    `groups` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `core_clicksign_settings_app_id_key`(`app_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `core_clicksign_settings` ADD CONSTRAINT `core_clicksign_settings_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
