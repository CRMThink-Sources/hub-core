-- CreateTable
CREATE TABLE `thinkzap_bot_flows` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `graph` JSON NOT NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `thinkzap_bot_flows_app_id_idx`(`app_id`),
    UNIQUE INDEX `thinkzap_bot_flows_app_id_name_key`(`app_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thinkzap_bot_flow_bindings` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `flow_id` VARCHAR(191) NOT NULL,
    `line_id` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `condition` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `thinkzap_bot_flow_bindings_app_id_line_id_key`(`app_id`, `line_id`),
    INDEX `thinkzap_bot_flow_bindings_app_id_line_id_priority_idx`(`app_id`, `line_id`, `priority`),
    INDEX `thinkzap_bot_flow_bindings_flow_id_idx`(`flow_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thinkzap_bot_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `bitrix_chat_id` VARCHAR(191) NOT NULL,
    `flow_id` VARCHAR(191) NOT NULL,
    `flow_version` INTEGER NOT NULL,
    `graph` JSON NOT NULL,
    `line_snapshot` JSON NOT NULL,
    `binding_id` VARCHAR(191) NULL,
    `current_node_id` VARCHAR(191) NOT NULL,
    `vars` JSON NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'HANDED_OFF', 'FINISHED', 'ABORTED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `closed_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `thinkzap_bot_sessions_app_id_bitrix_chat_id_status_idx`(`app_id`, `bitrix_chat_id`, `status`),
    INDEX `thinkzap_bot_sessions_flow_id_idx`(`flow_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thinkzap_bot_flows` ADD CONSTRAINT `thinkzap_bot_flows_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thinkzap_bot_flow_bindings` ADD CONSTRAINT `thinkzap_bot_flow_bindings_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thinkzap_bot_flow_bindings` ADD CONSTRAINT `thinkzap_bot_flow_bindings_flow_id_fkey` FOREIGN KEY (`flow_id`) REFERENCES `thinkzap_bot_flows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thinkzap_bot_sessions` ADD CONSTRAINT `thinkzap_bot_sessions_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thinkzap_bot_sessions` ADD CONSTRAINT `thinkzap_bot_sessions_flow_id_fkey` FOREIGN KEY (`flow_id`) REFERENCES `thinkzap_bot_flows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
