-- Sincronização Stripe → SPA 1142: rodadas e ações por assinatura. Só tabelas novas.

-- CreateTable
CREATE TABLE `core_stripe_sync_runs` (
    `id` VARCHAR(191) NOT NULL,
    `trigger` ENUM('SCHEDULED', 'MANUAL') NOT NULL,
    `triggered_by_portal_user_id` VARCHAR(191) NULL,
    `status` ENUM('RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,
    `checked` INTEGER NOT NULL DEFAULT 0,
    `skipped` INTEGER NOT NULL DEFAULT 0,
    `updated` INTEGER NOT NULL DEFAULT 0,
    `cancelled` INTEGER NOT NULL DEFAULT 0,
    `lines_unsubscribed` INTEGER NOT NULL DEFAULT 0,
    `not_found` INTEGER NOT NULL DEFAULT 0,
    `failed` INTEGER NOT NULL DEFAULT 0,
    `paused` BOOLEAN NOT NULL DEFAULT false,
    `error` TEXT NULL,

    INDEX `core_stripe_sync_runs_started_at_idx`(`started_at`),
    INDEX `core_stripe_sync_runs_triggered_by_portal_user_id_idx`(`triggered_by_portal_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_stripe_sync_changes` (
    `id` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `gateway_id` VARCHAR(191) NOT NULL,
    `item_id` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NULL,
    `from_status` VARCHAR(191) NULL,
    `to_status` VARCHAR(191) NULL,
    `from_period_end` DATETIME(3) NULL,
    `to_period_end` DATETIME(3) NULL,
    `succeeded` BOOLEAN NOT NULL,
    `error` TEXT NULL,

    INDEX `core_stripe_sync_changes_run_id_idx`(`run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `core_stripe_sync_runs` ADD CONSTRAINT `core_stripe_sync_runs_triggered_by_portal_user_id_fkey` FOREIGN KEY (`triggered_by_portal_user_id`) REFERENCES `portal_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_stripe_sync_changes` ADD CONSTRAINT `core_stripe_sync_changes_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `core_stripe_sync_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
