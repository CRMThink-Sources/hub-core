-- CreateTable
CREATE TABLE `core_thinkanalise_connectors` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `biconnector_id` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `provider` ENUM('ASAAS', 'CONTA_AZUL', 'OMIE') NOT NULL,
    `api_key` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `core_thinkanalise_connectors_app_id_idx`(`app_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `core_thinkanalise_connectors` ADD CONSTRAINT `core_thinkanalise_connectors_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
