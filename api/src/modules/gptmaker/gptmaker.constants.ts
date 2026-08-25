/** AppCode id da instalação GPT Maker (`core_app_codes.id`). */
export const GPTMAKER_APP_CODE_ID = 'crmthink.gptmaker'

/**
 * Teto de agentes por instalação.
 *
 * Vem do Bitrix, não de plano: o portal aceita no máximo 5 imbots por
 * aplicação. Não varia por cliente e não é negociável — o HubThink chegou a ter
 * um limite por plano (`plan !== 'pro'`) que foi abandonado justamente porque o
 * teto real é este.
 */
export const MAX_AGENTS_PER_APP = 5

/**
 * Prefixo do `CODE` do imbot criado por esta aplicação.
 *
 * É o que permite contar, entre todos os bots do portal do cliente, só os que
 * são nossos — o portal pode ter bots de outras aplicações.
 */
export const GPTMAKER_BOT_CODE_PREFIX = 'gptmaker_'
