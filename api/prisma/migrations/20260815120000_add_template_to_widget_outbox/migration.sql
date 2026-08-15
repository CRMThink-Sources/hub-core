-- Envio de template pelo widget passa a usar o mesmo outbox do envio livre.
--
-- Antes desta migration o template era entregue dentro do request: um 500 transitorio
-- da HubMessage perdia a mensagem, e o operador so descobria pela ausencia dela. O
-- outbox ja resolvia isso para o envio livre; o que faltava era a intencao saber que
-- tipo de chamada o worker deve fazer.
--
-- `kind` com DEFAULT 'TEXT' torna a migration aditiva: toda row existente e de envio
-- livre, e o codigo anterior nao le nenhuma das colunas novas. Pode subir antes do
-- deploy da aplicacao.
--
-- Os tres campos de template ficam NULL em `kind = TEXT`. Nao ha CHECK amarrando os
-- dois estados: o MySQL 5.7 do parque nao valida CHECK, e a garantia real esta no
-- guard do despacho, que recusa row de template sem nome ou idioma antes de
-- reivindicar o envio.
ALTER TABLE `core_thinkerszap_widget_outbox`
    ADD COLUMN `kind` ENUM('TEXT', 'TEMPLATE') NOT NULL DEFAULT 'TEXT',
    -- Nome do template aprovado, como cadastrado na Meta.
    ADD COLUMN `template_name` VARCHAR(191) NULL,
    -- Idioma do template (ex.: pt_BR). Com o nome, identifica a versao aprovada.
    ADD COLUMN `template_language` VARCHAR(191) NULL,
    -- Valores das variaveis do corpo, na ordem posicional de aparicao.
    ADD COLUMN `template_parameters` JSON NULL;
