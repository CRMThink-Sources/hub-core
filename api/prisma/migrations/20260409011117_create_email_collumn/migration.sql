/*
  Warnings:

  - A unique constraint covering the columns `[instance_id]` on the table `core_thinkerszap_instances` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `core_apps` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `core_apps` ADD COLUMN `email` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `core_thinkerszap_instances_instance_id_key` ON `core_thinkerszap_instances`(`instance_id`);
