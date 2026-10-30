-- Novidades do ThinkZap (backoffice + aba do cliente).
--
-- Aditiva: tabela nova, nada existente muda. Pode subir antes do deploy da aplicacao.
-- CreateTable
CREATE TABLE `thinkzap_product_updates` (
    `id` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,
    `published_content` JSON NULL,
    `progress` ENUM('PENDING', 'DONE') NOT NULL DEFAULT 'PENDING',
    `done_at` DATETIME(3) NULL,
    `completed_by` VARCHAR(191) NULL,
    `visibility` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `first_published_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `published_by` VARCHAR(191) NULL,
    `available_at` DATETIME(3) NULL,
    `bitrix_task_id` INTEGER NULL,
    `bitrix_task_title` TEXT NULL,
    `bitrix_task_status` INTEGER NULL,
    `bitrix_task_group_id` INTEGER NULL,
    `bitrix_task_synced_at` DATETIME(3) NULL,
    `created_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `thinkzap_product_updates_bitrix_task_id_key`(`bitrix_task_id`),
    INDEX `thinkzap_product_updates_visibility_idx`(`visibility`),
    INDEX `thinkzap_product_updates_created_by_idx`(`created_by`),
    INDEX `thinkzap_product_updates_published_by_idx`(`published_by`),
    INDEX `thinkzap_product_updates_completed_by_idx`(`completed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thinkzap_product_updates` ADD CONSTRAINT `thinkzap_product_updates_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `portal_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thinkzap_product_updates` ADD CONSTRAINT `thinkzap_product_updates_published_by_fkey` FOREIGN KEY (`published_by`) REFERENCES `portal_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thinkzap_product_updates` ADD CONSTRAINT `thinkzap_product_updates_completed_by_fkey` FOREIGN KEY (`completed_by`) REFERENCES `portal_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
