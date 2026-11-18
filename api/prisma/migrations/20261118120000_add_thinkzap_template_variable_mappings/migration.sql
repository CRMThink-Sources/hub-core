-- Variaveis padrao do envio de template: campo do Bitrix que alimenta cada variavel,
-- por linha, template e tipo de entidade.
--
-- Aditiva: tabela nova, nada existente muda. Pode subir antes do deploy da aplicacao.
-- CreateTable
CREATE TABLE `core_thinkerszap_template_variable_mappings` (
    `id` VARCHAR(191) NOT NULL,
    `domain_id` VARCHAR(191) NOT NULL,
    `subscription_item_id` VARCHAR(191) NOT NULL,
    `template_name` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `entity_type_id` INTEGER NOT NULL,
    `mappings` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_tz_tpl_var_mapping_line`(`domain_id`, `subscription_item_id`),
    UNIQUE INDEX `uq_tz_tpl_var_mapping`(`domain_id`, `subscription_item_id`, `template_name`, `language`, `entity_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
