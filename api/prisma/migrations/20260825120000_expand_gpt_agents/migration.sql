-- `core_gpt_agents` deixa de ser um stub e passa a carregar a configuracao local
-- do agente do GPT Maker.
--
-- Todos os agentes de todos os clientes vivem no MESMO workspace do vendor,
-- porque a cobranca e por creditos e nao pelo workspace do cliente. O vendor nao
-- conhece instalacao: um `gpt_maker_agent_id` do cliente A e aceito pela API dele
-- se enviado pelo cliente B. Esta tabela e a unica fronteira entre clientes.
--
-- Aditiva sobre tabela vazia: nenhum agente existe em producao, todas as colunas
-- novas tem default ou aceitam NULL, e nao ha backfill. Pode subir antes do deploy
-- da aplicacao.
--
-- `gpt_maker_agent_id` MANTEM o unique global que ja tinha. Nao vira composto com
-- `app_id`: o id e do vendor e o workspace e compartilhado, entao ele ja e unico no
-- sistema inteiro, e e a restricao global que impede duas instalacoes
-- reivindicarem o mesmo agente. Um composto seria mais fraco, nao mais forte.
--
-- `bot_id`, ao contrario, e escopado por instalacao: `BOT_ID` e sequencial DENTRO
-- de cada portal do Bitrix, entao dois clientes tem bot 5. Unique global ali faria
-- a segunda instalacao a criar um bot com id repetido falhar com erro de constraint
-- sem relacao com a causa.
ALTER TABLE `core_gpt_agents`
    ADD COLUMN `bot_id` INTEGER NULL,
    ADD COLUMN `name` VARCHAR(191) NULL,
    ADD COLUMN `worktime_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `init_hour` CHAR(5) NULL,
    ADD COLUMN `end_hour` CHAR(5) NULL,
    ADD COLUMN `active_days` JSON NULL,
    ADD COLUMN `timezone` VARCHAR(191) NULL,
    ADD COLUMN `responds_only_off_hours` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `exit_on_collaborator_join` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX `core_gpt_agents_app_id_bot_id_key` ON `core_gpt_agents`(`app_id`, `bot_id`);

-- CreateIndex
CREATE INDEX `core_gpt_agents_app_id_idx` ON `core_gpt_agents`(`app_id`);

-- A desinstalacao do app hoje muda `status` e nao apaga a linha de `core_apps`, entao
-- o cascade e rede de seguranca para exclusao manual, nao caminho normal. Fica
-- registrado que ele NAO apaga o agente no vendor: quem faz isso e o caso de uso de
-- exclusao, e o que cobre o que escapar e a rotina de reconciliacao.
ALTER TABLE `core_gpt_agents` DROP FOREIGN KEY `core_gpt_agents_app_id_fkey`;
ALTER TABLE `core_gpt_agents` ADD CONSTRAINT `core_gpt_agents_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `core_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
