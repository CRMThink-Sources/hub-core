CREATE TABLE `core_importsheets_auth_token` (
  `id` VARCHAR(191) NOT NULL,
  `app_id` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL DEFAULT 'google',
  `google_sub` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `scope` TEXT NULL,
  `refresh_token` TEXT NOT NULL,
  `access_token` TEXT NULL,
  `access_token_expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `core_importsheets_auth_token_app_id_key`(`app_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `core_importsheets_auth_token`
  ADD CONSTRAINT `core_importsheets_auth_token_app_id_fkey`
  FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
