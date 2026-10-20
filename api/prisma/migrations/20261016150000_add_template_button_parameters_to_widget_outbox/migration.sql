-- Valores dos botoes dinamicos do template (link com variavel e copiar codigo).
--
-- Ficam ao lado de `template_parameters` pelo mesmo motivo: o reprocessamento da fila
-- tem de reenviar exatamente o que o operador ou o robo pediram. Formato
-- `[{ "index": 1, "subType": "URL", "value": "PED-1" }]`, com `index` = posicao do
-- botao entre todos os botoes do template.
--
-- Coluna nullable e aditiva: row existente fica NULL e e enviada sem botao, como
-- antes. Pode subir antes do deploy da aplicacao.
ALTER TABLE `core_thinkerszap_widget_outbox`
    ADD COLUMN `template_button_parameters` JSON NULL;
