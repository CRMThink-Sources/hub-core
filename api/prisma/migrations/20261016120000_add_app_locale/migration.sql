-- Idioma escolhido no app, por instalacao. Nulo = nunca escolhido (avisos em pt).
-- Lido pelo servidor para avisos gerados sem tela aberta, como o do limite diario
-- do ThinkZap no chat do canal aberto e na timeline do CRM.
ALTER TABLE `core_apps` ADD COLUMN `locale` VARCHAR(5) NULL;
