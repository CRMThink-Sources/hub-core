-- CreateTable
CREATE TABLE `thinkzap_bot_flow_bots` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `bitrix_bot_id` INTEGER NOT NULL,
    `bot_token` TEXT NOT NULL,
    `webhook_url` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `thinkzap_bot_flow_bots_app_id_key`(`app_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thinkzap_bot_flow_bots` ADD CONSTRAINT `thinkzap_bot_flow_bots_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
