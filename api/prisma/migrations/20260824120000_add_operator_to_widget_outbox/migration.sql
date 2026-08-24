-- A intencao de envio do widget passa a guardar o operador que a originou.
--
-- Sem esta coluna o worker nao tinha como saber quem escreveu: quem clicou em enviar
-- so e conhecido dentro da requisicao, e a entrega acontece depois, em outro processo.
-- Era por isso que o ajuste "Prefixar nome do operador" nao tinha efeito nenhum no
-- envio pelo widget, enquanto o canal aberto do Bitrix prefixava com a mesma
-- configuracao de linha.
--
-- NULL nas rows existentes e o estado esperado, nao pendencia de backfill: elas
-- entregam sem prefixo, que e exatamente o comportamento que ja tinham. Aditiva —
-- pode subir antes do deploy da aplicacao.
--
-- O operador NAO e gravado em `text`: aquela coluna alimenta o espelho no canal
-- aberto, o comentario de timeline e o aviso de falha, e nos tres o autor ja e
-- conhecido. O prefixo e do contato.
ALTER TABLE `core_thinkerszap_widget_outbox`
    ADD COLUMN `operator_bitrix_user_id` VARCHAR(191) NULL;
