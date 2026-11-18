-- CreateTable
CREATE TABLE `thinkzap_access_groups` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `thinkzap_access_groups_app_id_idx`(`app_id`),
    UNIQUE INDEX `thinkzap_access_groups_app_id_name_key`(`app_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thinkzap_access_group_members` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `bitrix_user_id` VARCHAR(191) NOT NULL,

    INDEX `thinkzap_access_group_members_bitrix_user_id_idx`(`bitrix_user_id`),
    UNIQUE INDEX `thinkzap_access_group_members_group_id_bitrix_user_id_key`(`group_id`, `bitrix_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thinkzap_access_group_lines` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `subscription_item_id` VARCHAR(191) NOT NULL,

    INDEX `thinkzap_access_group_lines_subscription_item_id_idx`(`subscription_item_id`),
    UNIQUE INDEX `thinkzap_access_group_lines_group_id_subscription_item_id_key`(`group_id`, `subscription_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thinkzap_access_groups` ADD CONSTRAINT `thinkzap_access_groups_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thinkzap_access_group_members` ADD CONSTRAINT `thinkzap_access_group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `thinkzap_access_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thinkzap_access_group_lines` ADD CONSTRAINT `thinkzap_access_group_lines_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `thinkzap_access_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
