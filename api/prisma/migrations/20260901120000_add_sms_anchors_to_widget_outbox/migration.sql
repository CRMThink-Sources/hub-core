-- A intencao de envio passa a guardar as ancoras do provedor de mensagem do Bitrix,
-- preenchidas so quando o envio veio de uma campanha de SMS.
--
-- `sms_sender_code` e `sms_message_id` sao o que `messageservice.message.status.update`
-- exige para casar o desfecho com a mensagem na tela de campanha. Sem as duas, o worker
-- nao teria como saber que aquele envio veio de campanha, nem para onde reportar.
--
-- NULL nas rows existentes e o estado esperado, nao pendencia de backfill: envio de
-- widget e de robo nao reporta status a lugar nenhum, e continua assim. Aditiva — pode
-- subir antes do deploy da aplicacao.
--
-- O UNIQUE em `sms_message_id` e a idempotencia da campanha, nao um indice de leitura:
-- retentativa do Bitrix e duplo disparo existem, e a segunda mensagem e visivel para o
-- contato — no HubMessage, cobrada duas vezes. No MySQL, NULL nao conflita com NULL num
-- indice unico, entao widget e robo continuam gravando sem restricao.
ALTER TABLE `core_thinkerszap_widget_outbox`
    ADD COLUMN `sms_sender_code` VARCHAR(191) NULL,
    ADD COLUMN `sms_message_id` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `core_thinkerszap_widget_outbox_sms_message_id_key`
    ON `core_thinkerszap_widget_outbox`(`sms_message_id`);
