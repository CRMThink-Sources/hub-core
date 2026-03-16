/*
  Warnings:

  - Added the required column `app_code_id` to the `billing_plans` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `billing_plans` ADD COLUMN `app_code_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `core_thinkerszap_instances` ADD COLUMN `vinculated_channel` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `billing_plans_app_code_id_idx` ON `billing_plans`(`app_code_id`);

-- AddForeignKey
ALTER TABLE `billing_plans` ADD CONSTRAINT `billing_plans_app_code_id_fkey` FOREIGN KEY (`app_code_id`) REFERENCES `core_app_codes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
