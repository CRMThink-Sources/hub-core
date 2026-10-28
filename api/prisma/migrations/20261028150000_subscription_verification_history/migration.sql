-- Verificação de assinaturas: contadores de linha e de cancelamento por rodada, e
-- registros por linha (desassinada/assinada) além das mudanças de status.
-- Aditiva: rodadas e registros antigos ficam com os valores padrão.

-- AlterTable
ALTER TABLE `core_subscription_expiration_runs`
    ADD COLUMN `lines_unsubscribed` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `cancelled` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lines_checked` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lines_subscribed` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reconciliation` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `provider_steps_skipped` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `core_subscription_expiration_changes`
    ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'status',
    ADD COLUMN `item_id` VARCHAR(191) NULL,
    ADD COLUMN `provider` VARCHAR(191) NULL,
    MODIFY `from_status` VARCHAR(191) NULL,
    MODIFY `to_status` VARCHAR(191) NULL,
    MODIFY `period_end` DATETIME(3) NULL;
