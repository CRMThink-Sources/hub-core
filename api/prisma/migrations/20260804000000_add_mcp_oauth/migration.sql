-- CreateTable
CREATE TABLE `core_mcp_users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `domain_id` VARCHAR(191) NOT NULL,
    `is_admin` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `core_mcp_users_email_key`(`email`),
    INDEX `core_mcp_users_domain_id_idx`(`domain_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_mcp_oauth_clients` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `client_name` VARCHAR(191) NULL,
    `redirect_uris` JSON NOT NULL,
    `grant_types` JSON NOT NULL,
    `response_types` JSON NOT NULL,
    `scope` VARCHAR(191) NULL,
    `token_endpoint_auth_method` VARCHAR(191) NOT NULL DEFAULT 'none',
    `client_uri` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `core_mcp_oauth_clients_client_id_key`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_mcp_auth_codes` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `domain_id` VARCHAR(191) NOT NULL,
    `code_challenge` VARCHAR(191) NOT NULL,
    `code_challenge_method` VARCHAR(191) NOT NULL DEFAULT 'S256',
    `redirect_uri` TEXT NOT NULL,
    `resource` TEXT NULL,
    `scopes` JSON NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `core_mcp_auth_codes_code_key`(`code`),
    INDEX `core_mcp_auth_codes_user_id_idx`(`user_id`),
    INDEX `core_mcp_auth_codes_client_id_idx`(`client_id`),
    INDEX `core_mcp_auth_codes_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_mcp_refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `domain_id` VARCHAR(191) NOT NULL,
    `scopes` JSON NOT NULL,
    `resource` TEXT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `rotated_to_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `core_mcp_refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `core_mcp_refresh_tokens_user_id_idx`(`user_id`),
    INDEX `core_mcp_refresh_tokens_client_id_idx`(`client_id`),
    INDEX `core_mcp_refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `core_mcp_users` ADD CONSTRAINT `core_mcp_users_domain_id_fkey` FOREIGN KEY (`domain_id`) REFERENCES `core_domains`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_mcp_auth_codes` ADD CONSTRAINT `core_mcp_auth_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `core_mcp_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_mcp_auth_codes` ADD CONSTRAINT `core_mcp_auth_codes_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `core_mcp_oauth_clients`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_mcp_refresh_tokens` ADD CONSTRAINT `core_mcp_refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `core_mcp_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `core_mcp_refresh_tokens` ADD CONSTRAINT `core_mcp_refresh_tokens_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `core_mcp_oauth_clients`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;
