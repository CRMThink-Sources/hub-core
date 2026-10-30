-- Vinculo do usuario do backoffice com o usuario do Bitrix24 da CRMThink.
--
-- Aditiva: coluna opcional, sem indice. Pode subir antes do deploy da aplicacao.
-- AlterTable
ALTER TABLE `portal_users` ADD COLUMN `bitrix_user_id` INTEGER NULL;
