CREATE TABLE `core_importsheets_imports` (
  `id`            INT            NOT NULL AUTO_INCREMENT,
  `app_id`        VARCHAR(191)   NOT NULL,
  `title`         VARCHAR(191)   NOT NULL,
  `config`        JSON           NOT NULL,
  `schedule_mode` ENUM('MANUAL','HOURS','DAYS') NOT NULL DEFAULT 'MANUAL',
  `every_hours`   INT            NULL,
  `weekdays`      JSON           NULL,
  `next_run_at`   DATETIME(3)    NULL,
  `enabled`       TINYINT(1)     NOT NULL DEFAULT 1,
  `last_run_at`   DATETIME(3)    NULL,
  `last_run_status` VARCHAR(191) NULL,
  `last_error`    LONGTEXT       NULL,
  `created_at`    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)    NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `core_importsheets_imports_app_id_idx` (`app_id`),
  INDEX `core_importsheets_imports_next_run_at_idx` (`next_run_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `core_importsheets_imports`
  ADD CONSTRAINT `core_importsheets_imports_app_id_fkey`
  FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
