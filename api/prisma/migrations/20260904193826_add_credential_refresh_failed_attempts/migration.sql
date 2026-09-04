-- AlterTable
ALTER TABLE `core_credentials` ADD COLUMN `refresh_failed_attempts` INTEGER NOT NULL DEFAULT 0;
