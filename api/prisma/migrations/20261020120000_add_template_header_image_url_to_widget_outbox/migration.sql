-- URL publica da imagem do cabecalho do template (template com cabecalho de imagem).
--
-- Fica ao lado de `template_parameters` e `template_button_parameters` pelo mesmo
-- motivo: o reprocessamento da fila tem de reenviar exatamente a imagem pedida.
--
-- Coluna nullable e aditiva: row existente fica NULL e e enviada sem cabecalho, como
-- antes. Pode subir antes do deploy da aplicacao.
ALTER TABLE `core_thinkerszap_widget_outbox`
    ADD COLUMN `template_header_image_url` TEXT NULL;
