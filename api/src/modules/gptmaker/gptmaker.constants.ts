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
 * Defaults de `type` e `communicationType` do agente.
 *
 * Não são preferência nossa: o `POST` de criação do vendor **exige** `type` e
 * recusa a criação com `400 {"error":"type is required"}` sem ele. Como a tela
 * de criação não pergunta os dois (eles são editados no perfil depois), a
 * criação precisa de um valor para mandar.
 */
export const DEFAULT_AGENT_TYPE = 'SUPPORT'
export const DEFAULT_COMMUNICATION_TYPE = 'NORMAL'

/**
 * Prefixo do `CODE` do imbot criado por esta aplicação.
 *
 * É o que permite contar, entre todos os bots do portal do cliente, só os que
 * são nossos — o portal pode ter bots de outras aplicações.
 */
export const GPTMAKER_BOT_CODE_PREFIX = 'gptmaker_'
