-- Confirmacao de entrega e de leitura informada pelo provider (ThinkZap).
--
-- Aditiva: so colunas nulas, sem indice e sem backfill. Pode subir antes do deploy
-- da aplicacao.

-- AlterTable
ALTER TABLE `core_thinkerszap_widget_outbox` ADD COLUMN `delivered_at` DATETIME(3) NULL,
    ADD COLUMN `read_at` DATETIME(3) NULL;
