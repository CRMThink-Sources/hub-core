-- Falhas de recebimento e log de tentativas que falharam (backoffice "Falhas").
--
-- Aditiva: duas tabelas novas, nenhuma existente e nenhuma coluna alterada. Pode subir
-- antes do deploy da aplicacao. As tabelas sao expurgadas por retencao (7 dias), por isso
-- ha indice em `created_at` em ambas.

-- CreateTable
CREATE TABLE `core_thinkerszap_inbound_failures` (
    `id` VARCHAR(191) NOT NULL,
    `job_id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `trace_key` VARCHAR(191) NULL,
    `domain_id` VARCHAR(191) NULL,
    `domain_name` VARCHAR(191) NULL,
    `instance_id` VARCHAR(191) NULL,
    `error_code` VARCHAR(191) NOT NULL,
    `error_message` TEXT NOT NULL,
    `attempts` INTEGER NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('FAILED', 'REPROCESSED') NOT NULL DEFAULT 'FAILED',
    `reprocess_count` INTEGER NOT NULL DEFAULT 0,
    `last_reprocessed_at` DATETIME(3) NULL,
    `last_reprocessed_by` VARCHAR(191) NULL,
    `previous_failure_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `core_thinkerszap_inbound_failures_created_at_idx`(`created_at`),
    INDEX `core_thinkerszap_inbound_failures_domain_id_created_at_idx`(`domain_id`, `created_at`),
    INDEX `core_thinkerszap_inbound_failures_source_created_at_idx`(`source`, `created_at`),
    INDEX `core_thinkerszap_inbound_failures_job_id_idx`(`job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `core_thinkerszap_delivery_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `ref_kind` ENUM('OUTBOX', 'INBOUND') NOT NULL,
    `ref_id` VARCHAR(191) NOT NULL,
    `attempt` INTEGER NOT NULL,
    `error_code` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `indeterminate` BOOLEAN NOT NULL DEFAULT false,
    `duration_ms` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `core_thinkerszap_delivery_attempts_ref_kind_ref_id_idx`(`ref_kind`, `ref_id`),
    INDEX `core_thinkerszap_delivery_attempts_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
