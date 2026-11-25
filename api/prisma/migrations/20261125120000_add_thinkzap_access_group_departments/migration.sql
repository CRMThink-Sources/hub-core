-- CreateTable
CREATE TABLE `thinkzap_access_group_departments` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `bitrix_department_id` VARCHAR(191) NOT NULL,
    `include_subdepartments` BOOLEAN NOT NULL DEFAULT false,

    INDEX `thinkzap_access_group_departments_bitrix_department_id_idx`(`bitrix_department_id`),
    UNIQUE INDEX `thinkzap_access_group_departments_group_id_bitrix_department_key`(`group_id`, `bitrix_department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thinkzap_access_group_departments` ADD CONSTRAINT `thinkzap_access_group_departments_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `thinkzap_access_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

