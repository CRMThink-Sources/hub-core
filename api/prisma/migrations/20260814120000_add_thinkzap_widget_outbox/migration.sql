-- Outbox do envio pelo widget: a intencao gravada ANTES de qualquer chamada ao
-- provider. E ela que permite enfileirar o envio sem transformar retentativa em
-- mensagem repetida no WhatsApp de quem recebe -- sem um registro anterior a
-- chamada, nada distingue "ja entreguei e perdi a resposta" de "nunca entreguei".
--
-- Tabela propria e nao colunas em core_thinkerszap_messages porque a unique de la e
-- (instance_id, provider_message_id) e o provider_message_id NAO existe antes do
-- envio: toda row pre-envio teria a chave nula e colidiria com as outras.
--
-- Aditiva: tabela nova, vazia, e o codigo anterior nao a conhece. Pode subir antes
-- do deploy da aplicacao.
CREATE TABLE `core_thinkerszap_widget_outbox` (
    `id` VARCHAR(191) NOT NULL,
    `client_message_id` VARCHAR(191) NOT NULL,
    `instance_id` VARCHAR(191) NOT NULL,
    `subscription_item_id` VARCHAR(191) NOT NULL,
    `domain_id` VARCHAR(191) NOT NULL,
    `app_code` VARCHAR(191) NOT NULL,
    `destination` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN') NOT NULL DEFAULT 'PENDING',
    -- A marca de entrega. NULL = o provider nao aceitou nada ainda; preenchido = ja
    -- entreguei, e nenhuma retentativa pode chamar o provider outra vez.
    `provider_message_id` VARCHAR(191) NULL,
    -- Idempotencia do comentario de timeline: crm.timeline.comment.add nao tem chave
    -- de idempotencia, entao sem este carimbo a retentativa duplicaria o comentario.
    `timeline_notified_at` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `sent_at` DATETIME(3) NULL,

    UNIQUE INDEX `core_thinkerszap_widget_outbox_instance_id_client_message_id_key`(`instance_id`, `client_message_id`),
    -- Serve o alerta de pendencia antiga e a limpeza por retencao.
    INDEX `core_thinkerszap_widget_outbox_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `core_thinkerszap_widget_outbox`
    ADD CONSTRAINT `core_thinkerszap_widget_outbox_instance_id_fkey`
    FOREIGN KEY (`instance_id`) REFERENCES `core_thinkerszap_instances`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
