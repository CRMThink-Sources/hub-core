-- CreateTable
CREATE TABLE `core_subscription_expiration_runs` (
    `id` VARCHAR(191) NOT NULL,
    `trigger` ENUM('SCHEDULED', 'MANUAL') NOT NULL,
    `triggered_by_portal_user_id` VARCHAR(191) NULL,
    `status` ENUM('RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,
    `checked` INTEGER NOT NULL DEFAULT 0,
    `trial_expired` INTEGER NOT NULL DEFAULT 0,
    `past_due` INTEGER NOT NULL DEFAULT 0,
    `failed` INTEGER NOT NULL DEFAULT 0,
    `paused` BOOLEAN NOT NULL DEFAULT false,
    `error` TEXT NULL,

    INDEX `core_subscription_expiration_runs_started_at_idx`(`started_at`),
    INDEX `core_subscription_expiration_runs_triggered_by_portal_user_i_idx`(`triggered_by_portal_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_subscription_expiration_changes` (
    `id` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `from_status` VARCHAR(191) NOT NULL,
    `to_status` VARCHAR(191) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `succeeded` BOOLEAN NOT NULL,
    `error` TEXT NULL,

    INDEX `core_subscription_expiration_changes_run_id_idx`(`run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `core_subscription_expiration_runs` ADD CONSTRAINT `core_subscription_expiration_runs_triggered_by_portal_user__fkey` FOREIGN KEY (`triggered_by_portal_user_id`) REFERENCES `portal_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_subscription_expiration_changes` ADD CONSTRAINT `core_subscription_expiration_changes_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `core_subscription_expiration_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

