-- Vinculo entre a instalacao (core_apps) e o item espelho dela na SPA 1060 do Bitrix.
-- NULL de proposito: instalacao existe sem espelho (instalada antes desta migration,
-- ou falha na criacao do item). O MySQL permite varios NULL num indice unico, que e
-- exatamente o desejado: N instalacoes sem espelho, no maximo uma por item da SPA.
-- Aditiva: o codigo anterior nao le esta coluna.
ALTER TABLE `core_apps`
    ADD COLUMN `spa_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `core_apps_spa_id_key` ON `core_apps`(`spa_id`);
