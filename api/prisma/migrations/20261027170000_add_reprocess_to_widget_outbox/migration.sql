-- Reprocessamento manual de intencoes com falha pelo portal admin ("Falhas de envio").
--
-- Aditiva: contador com default 0 e as duas colunas de auditoria nullable. Pode subir
-- antes do deploy da aplicacao. A listagem usa o indice `[status, created_at]`, que ja
-- existe.
-- AlterTable
ALTER TABLE `core_thinkerszap_widget_outbox` ADD COLUMN `reprocess_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `last_reprocessed_at` DATETIME(3) NULL,
    ADD COLUMN `last_reprocessed_by` VARCHAR(191) NULL;
