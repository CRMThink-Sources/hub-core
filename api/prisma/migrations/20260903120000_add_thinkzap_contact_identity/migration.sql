-- Mapa `lid <-> telefone` de contato em linha Z-API.
--
-- Existe porque a Z-API entrega o contato ora pelo telefone, ora pelo `@lid`, no mesmo
-- campo `phone` do webhook. O Bitrix identifica a sessao do canal aberto pelo `chat.id`,
-- entao as duas formas viravam dois contatos e duas conversas para a mesma pessoa. A
-- identidade passa a ser o LID, que e o unico valor estavel, e esta tabela e o que
-- permite chegar nele quando o evento traz telefone e nenhum LID.
--
-- `phone` e NULL para contato que nunca expos o numero. Nao e pendencia de backfill: a
-- conversao LID -> telefone e impossivel por decisao de privacidade do WhatsApp, entao
-- esse NULL e permanente e correto.
--
-- `legacy_phone_identity` guarda a identidade que o contato JA usa numa sessao aberta
-- antes desta mudanca. So o script de backfill escreve nela, e so antes de a resolucao
-- por LID ser ligada. Row com valor aqui mantem aquele `chat.id` para sempre — trocar a
-- chave faria o Bitrix abrir conversa nova para quem ja tem uma, e o `imconnector` nao
-- oferece remapear `chat.id`.
--
-- Os dois UNIQUE sao a garantia de identidade, nao indice de leitura: dois `lid` iguais
-- na mesma instancia, ou dois telefones iguais, significam duas identidades para o mesmo
-- contato — exatamente o defeito que esta tabela existe para impedir. No MySQL, NULL nao
-- conflita com NULL num indice unico, entao varios contatos lid-only convivem sem
-- telefone.
--
-- Aditiva: pode subir antes do deploy da aplicacao.
CREATE TABLE `core_thinkerszap_contact_identities` (
    `id` VARCHAR(191) NOT NULL,
    `instance_id` VARCHAR(191) NOT NULL,
    `lid` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `legacy_phone_identity` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_identity_instance_lid`(`instance_id`, `lid`),
    UNIQUE INDEX `uq_identity_instance_phone`(`instance_id`, `phone`),
    INDEX `core_thinkerszap_contact_identities_instance_id_idx`(`instance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `core_thinkerszap_contact_identities`
    ADD CONSTRAINT `core_thinkerszap_contact_identities_instance_id_fkey`
    FOREIGN KEY (`instance_id`) REFERENCES `core_thinkerszap_instances`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
