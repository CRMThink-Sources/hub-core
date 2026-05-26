-- AlterTable
ALTER TABLE `thinkzap_allowed_users` ADD COLUMN `permissions` JSON NOT NULL DEFAULT ('{"connectors":{"read":true,"create":true,"update":true,"delete":true},"finance":{"read":false,"create":false,"update":false,"delete":false}}');
