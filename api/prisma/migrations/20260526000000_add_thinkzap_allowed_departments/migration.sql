-- CreateTable
CREATE TABLE `thinkzap_allowed_departments` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `bitrix_department_id` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NULL,
    `permissions` JSON NOT NULL DEFAULT (JSON_OBJECT('connectors', JSON_OBJECT('read', true, 'create', true, 'update', true, 'delete', true), 'finance', JSON_OBJECT('read', false, 'create', false, 'update', false, 'delete', false))),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `thinkzap_allowed_departments_app_id_idx`(`app_id`),
    UNIQUE INDEX `thinkzap_allowed_departments_app_id_bitrix_department_id_key`(`app_id`, `bitrix_department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thinkzap_allowed_departments` ADD CONSTRAINT `thinkzap_allowed_departments_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
