CREATE TABLE `core_thinkanalise_auth_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `app_id` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `token_key` CHAR(36) NOT NULL,
  `bitrix_source_id` INTEGER NULL,
  `account_id` VARCHAR(191) NULL,
  `refresh_token` LONGTEXT NOT NULL,
  `refresh_token_hash` CHAR(64) NOT NULL,
  `access_token` LONGTEXT NULL,
  `access_token_expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `core_thinkanalise_auth_tokens_token_key_key`(`token_key`),
  UNIQUE INDEX `core_thinkanalise_auth_tokens_bitrix_source_id_key`(`bitrix_source_id`),
  UNIQUE INDEX `core_thinkanalise_auth_tokens_refresh_token_hash_key`(`refresh_token_hash`),
  INDEX `core_thinkanalise_auth_tokens_app_id_idx`(`app_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `core_thinkanalise_auth_tokens`
  ADD CONSTRAINT `core_thinkanalise_auth_tokens_app_id_fkey`
  FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
