ALTER TABLE `core_thinkanalise_auth_tokens` MODIFY COLUMN `refresh_token` TEXT NOT NULL;
ALTER TABLE `core_thinkanalise_auth_tokens` MODIFY COLUMN `access_token` TEXT NULL;
