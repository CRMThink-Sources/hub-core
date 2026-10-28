-- Imagem padrao do envio de template com cabecalho de imagem, por linha.
--
-- Aditiva: tabela nova, nada existente muda. Pode subir antes do deploy da aplicacao.
-- CreateTable
CREATE TABLE `core_thinkerszap_template_defaults` (
    `id` VARCHAR(191) NOT NULL,
    `domain_id` VARCHAR(191) NOT NULL,
    `subscription_item_id` VARCHAR(191) NOT NULL,
    `template_name` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `header_image_url` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `core_thinkerszap_template_defaults_domain_id_subscription_it_idx`(`domain_id`, `subscription_item_id`),
    UNIQUE INDEX `core_thinkerszap_template_defaults_domain_id_subscription_it_key`(`domain_id`, `subscription_item_id`, `template_name`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
