/*
  Warnings:

  - You are about to drop the column `cancel_at_period_end` on the `billing_subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `cancelled_at` on the `billing_subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `current_period_end` on the `billing_subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `current_period_start` on the `billing_subscriptions` table. All the data in the column will be lost.
  - You are about to drop the `billing_purchases` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[instance_id]` on the table `core_thinkerszap_connectors` will be added. If there are existing duplicate values, this will fail.
  - Made the column `stripe_subscription_id` on table `billing_subscriptions` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `app_id` to the `core_thinkerszap_connectors` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `billing_purchases` DROP FOREIGN KEY `billing_purchases_app_id_fkey`;

-- DropForeignKey
ALTER TABLE `billing_purchases` DROP FOREIGN KEY `billing_purchases_plan_id_fkey`;

-- DropForeignKey
ALTER TABLE `billing_subscriptions` DROP FOREIGN KEY `billing_subscriptions_plan_id_fkey`;

-- DropIndex
DROP INDEX `billing_subscriptions_plan_id_fkey` ON `billing_subscriptions`;

-- AlterTable
ALTER TABLE `billing_subscriptions` DROP COLUMN `cancel_at_period_end`,
    DROP COLUMN `cancelled_at`,
    DROP COLUMN `current_period_end`,
    DROP COLUMN `current_period_start`,
    ADD COLUMN `connector_quantity` INTEGER NOT NULL DEFAULT 0,
    MODIFY `plan_id` INTEGER NULL,
    MODIFY `stripe_subscription_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `core_thinkerszap_connectors` ADD COLUMN `app_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `status` ENUM('PENDING_SETUP', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'PENDING_SETUP';

-- DropTable
DROP TABLE `billing_purchases`;

-- CreateIndex
CREATE UNIQUE INDEX `core_thinkerszap_connectors_instance_id_key` ON `core_thinkerszap_connectors`(`instance_id`);

-- CreateIndex
CREATE INDEX `core_thinkerszap_connectors_app_id_idx` ON `core_thinkerszap_connectors`(`app_id`);

-- AddForeignKey
ALTER TABLE `billing_subscriptions` ADD CONSTRAINT `billing_subscriptions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_thinkerszap_connectors` ADD CONSTRAINT `core_thinkerszap_connectors_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_thinkerszap_connectors` ADD CONSTRAINT `core_thinkerszap_connectors_instance_id_fkey` FOREIGN KEY (`instance_id`) REFERENCES `core_thinkerszap_instances`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
