-- CreateTable
CREATE TABLE `core_domains` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `core_domains_name_key`(`name`),
    UNIQUE INDEX `core_domains_member_id_key`(`member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_app_codes` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `core_app_codes_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_apps` (
    `id` VARCHAR(191) NOT NULL,
    `domain_id` VARCHAR(191) NOT NULL,
    `app_code_id` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL') NOT NULL DEFAULT 'ACTIVE',
    `installed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `core_apps_domain_id_idx`(`domain_id`),
    INDEX `core_apps_app_code_id_idx`(`app_code_id`),
    UNIQUE INDEX `core_apps_domain_id_app_code_id_key`(`domain_id`, `app_code_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_credentials` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `client_secret` VARCHAR(191) NOT NULL,
    `access_token` TEXT NULL,
    `refresh_token` TEXT NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `core_credentials_app_id_key`(`app_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `app_id` VARCHAR(191) NOT NULL,
    `current_balance` INTEGER NOT NULL DEFAULT 0,
    `total_purchased` INTEGER NOT NULL DEFAULT 0,
    `total_consumed` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `billing_balances_app_id_key`(`app_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `app_id` VARCHAR(191) NOT NULL,
    `type` ENUM('PURCHASE', 'CONSUMPTION', 'BONUS', 'REFUND', 'EXPIRATION') NOT NULL,
    `amount` INTEGER NOT NULL,
    `balance_after` INTEGER NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `reference_id` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `billing_transactions_app_id_idx`(`app_id`),
    INDEX `billing_transactions_type_idx`(`type`),
    INDEX `billing_transactions_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('CREDITS', 'SUBSCRIPTION') NOT NULL DEFAULT 'CREDITS',
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `credits` INTEGER NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `bonus_credits` INTEGER NULL,
    `is_recurring` BOOLEAN NOT NULL DEFAULT false,
    `stripe_price_id` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `billing_plans_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `plan_id` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING', 'INCOMPLETE', 'INCOMPLETE_EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `current_period_start` DATETIME(3) NOT NULL,
    `current_period_end` DATETIME(3) NOT NULL,
    `stripe_subscription_id` VARCHAR(191) NULL,
    `cancel_at_period_end` BOOLEAN NOT NULL DEFAULT false,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `billing_subscriptions_stripe_subscription_id_key`(`stripe_subscription_id`),
    INDEX `billing_subscriptions_app_id_idx`(`app_id`),
    INDEX `billing_subscriptions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_purchases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `app_id` VARCHAR(191) NOT NULL,
    `plan_id` INTEGER NULL,
    `credits` INTEGER NOT NULL,
    `bonus_credits` INTEGER NOT NULL DEFAULT 0,
    `price_paid` DECIMAL(10, 2) NOT NULL,
    `payment_method` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmed_at` DATETIME(3) NULL,

    INDEX `billing_purchases_app_id_idx`(`app_id`),
    INDEX `billing_purchases_status_idx`(`status`),
    INDEX `billing_purchases_payment_id_idx`(`payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_gpt_agents` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `gpt_maker_agent_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `core_gpt_agents_gpt_maker_agent_id_key`(`gpt_maker_agent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_thinkerszap_instances` (
    `id` VARCHAR(191) NOT NULL,
    `domain_id` VARCHAR(191) NOT NULL,
    `instance_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `core_apps` ADD CONSTRAINT `core_apps_domain_id_fkey` FOREIGN KEY (`domain_id`) REFERENCES `core_domains`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_apps` ADD CONSTRAINT `core_apps_app_code_id_fkey` FOREIGN KEY (`app_code_id`) REFERENCES `core_app_codes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_credentials` ADD CONSTRAINT `core_credentials_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_balances` ADD CONSTRAINT `billing_balances_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `billing_transactions_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `billing_balances`(`app_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_subscriptions` ADD CONSTRAINT `billing_subscriptions_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_subscriptions` ADD CONSTRAINT `billing_subscriptions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_purchases` ADD CONSTRAINT `billing_purchases_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `billing_balances`(`app_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_purchases` ADD CONSTRAINT `billing_purchases_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_gpt_agents` ADD CONSTRAINT `core_gpt_agents_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_thinkerszap_instances` ADD CONSTRAINT `core_thinkerszap_instances_domain_id_fkey` FOREIGN KEY (`domain_id`) REFERENCES `core_domains`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
