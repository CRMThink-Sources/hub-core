-- Categoria `thinkbot` na matriz de permissoes do ThinkZap, com a acao extra `publish`.
--
-- Backfill herda de `connectors`, que protegia o ThinkBot ate aqui: ninguem ganha nem
-- perde acesso no deploy. `publish` copia `update` porque publicar exigia `update`.
-- O parse da aplicacao faz a mesma derivacao para rows sem a chave, entao a ordem
-- entre migration e deploy nao importa.
UPDATE `thinkzap_allowed_users`
SET `permissions` = JSON_SET(
    `permissions`,
    '$.thinkbot',
    JSON_OBJECT(
        'read', JSON_EXTRACT(`permissions`, '$.connectors.read'),
        'create', JSON_EXTRACT(`permissions`, '$.connectors.create'),
        'update', JSON_EXTRACT(`permissions`, '$.connectors.update'),
        'delete', JSON_EXTRACT(`permissions`, '$.connectors.delete'),
        'publish', JSON_EXTRACT(`permissions`, '$.connectors.update')
    )
)
WHERE JSON_EXTRACT(`permissions`, '$.thinkbot') IS NULL
  AND JSON_EXTRACT(`permissions`, '$.connectors') IS NOT NULL;

UPDATE `thinkzap_allowed_departments`
SET `permissions` = JSON_SET(
    `permissions`,
    '$.thinkbot',
    JSON_OBJECT(
        'read', JSON_EXTRACT(`permissions`, '$.connectors.read'),
        'create', JSON_EXTRACT(`permissions`, '$.connectors.create'),
        'update', JSON_EXTRACT(`permissions`, '$.connectors.update'),
        'delete', JSON_EXTRACT(`permissions`, '$.connectors.delete'),
        'publish', JSON_EXTRACT(`permissions`, '$.connectors.update')
    )
)
WHERE JSON_EXTRACT(`permissions`, '$.thinkbot') IS NULL
  AND JSON_EXTRACT(`permissions`, '$.connectors') IS NOT NULL;

-- AlterTable
ALTER TABLE `thinkzap_allowed_users` MODIFY COLUMN `permissions` JSON NOT NULL DEFAULT ('{"connectors":{"read":true,"create":true,"update":true,"delete":true},"finance":{"read":false,"create":false,"update":false,"delete":false},"thinkbot":{"read":true,"create":true,"update":true,"delete":true,"publish":true}}');

-- AlterTable
ALTER TABLE `thinkzap_allowed_departments` MODIFY COLUMN `permissions` JSON NOT NULL DEFAULT ('{"connectors":{"read":true,"create":true,"update":true,"delete":true},"finance":{"read":false,"create":false,"update":false,"delete":false},"thinkbot":{"read":true,"create":true,"update":true,"delete":true,"publish":true}}');
