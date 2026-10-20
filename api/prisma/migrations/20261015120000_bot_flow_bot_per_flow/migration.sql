-- AddColumn
ALTER TABLE `thinkzap_bot_flow_bots` ADD COLUMN `flow_id` VARCHAR(191) NULL;

-- Backfill: até aqui era um fluxo por instalação, então o bot existente é o do único fluxo.
UPDATE `thinkzap_bot_flow_bots` b
JOIN (
    SELECT `app_id`, MIN(`id`) AS `flow_id`
    FROM `thinkzap_bot_flows`
    GROUP BY `app_id`
    HAVING COUNT(*) = 1
) f ON f.`app_id` = b.`app_id`
SET b.`flow_id` = f.`flow_id`;

-- O índice novo antes de soltar o unique: a FK de `app_id` precisa de um índice.
CREATE INDEX `thinkzap_bot_flow_bots_app_id_idx` ON `thinkzap_bot_flow_bots`(`app_id`);
DROP INDEX `thinkzap_bot_flow_bots_app_id_key` ON `thinkzap_bot_flow_bots`;

CREATE UNIQUE INDEX `thinkzap_bot_flow_bots_flow_id_key` ON `thinkzap_bot_flow_bots`(`flow_id`);
CREATE UNIQUE INDEX `thinkzap_bot_flow_bots_app_id_bitrix_bot_id_key` ON `thinkzap_bot_flow_bots`(`app_id`, `bitrix_bot_id`);

-- AddForeignKey
ALTER TABLE `thinkzap_bot_flow_bots` ADD CONSTRAINT `thinkzap_bot_flow_bots_flow_id_fkey` FOREIGN KEY (`flow_id`) REFERENCES `thinkzap_bot_flows`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
