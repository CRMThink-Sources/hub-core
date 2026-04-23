/*
  Warnings:

  - Added the required column `secret` to the `core_app_codes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `core_app_codes` ADD COLUMN `secret` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `core_thinkerszap_instances` ADD COLUMN `status` ENUM('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR') NOT NULL DEFAULT 'DISCONNECTED',
    ADD COLUMN `z_api_token` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `core_thinkerszap_connectors` (
    `id` VARCHAR(191) NOT NULL,
    `instance_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_thinkerszap_conversations` (
    `id` VARCHAR(191) NOT NULL,
    `instanceId` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `bitrixChatId` VARCHAR(191) NOT NULL,
    `bitrixChannelId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `core_thinkerszap_conversations_instanceId_idx`(`instanceId`),
    INDEX `core_thinkerszap_conversations_bitrixChatId_idx`(`bitrixChatId`),
    UNIQUE INDEX `core_thinkerszap_conversations_instanceId_phoneNumber_key`(`instanceId`, `phoneNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `core_thinkerszap_conversations` ADD CONSTRAINT `core_thinkerszap_conversations_instanceId_fkey` FOREIGN KEY (`instanceId`) REFERENCES `core_thinkerszap_instances`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
