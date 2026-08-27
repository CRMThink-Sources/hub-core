import { axiosGptMaker } from '@/infra/client/axios-gptmaker'

export const MAX_AGENTS = 5

export type CommunicationType = 'FORMAL' | 'NORMAL' | 'RELAXED'
export type AgentType = 'SUPPORT' | 'SALE' | 'PERSONAL'

/**
 * Ordem em que as opções aparecem nos selects. Aqui e não no componente porque
 * a criação e a edição de perfil oferecem a mesma lista — duplicar deixaria as
 * duas telas divergirem quando o vendor ganhar um valor novo.
 */
export const COMMUNICATION_TYPES: CommunicationType[] = [
  'FORMAL',
  'NORMAL',
  'RELAXED',
]
export const AGENT_TYPES: AgentType[] = ['SUPPORT', 'SALE', 'PERSONAL']

export type Worktime = {
  enabled: boolean
  initHour: string | null
  endHour: string | null
  activeDays: number[]
  timezone: string | null
  /** `true` = o agente atende FORA do expediente e silencia dentro dele. */
  respondsOnlyOffHours: boolean
}

export type VendorAgent = {
  id: string
  name: string
  avatar?: string
  behavior?: string
  communicationType?: CommunicationType
  type?: AgentType
  jobName?: string
  jobSite?: string
  jobDescription?: string
}

export type Agent = {
  id: string
  gptMakerAgentId: string
  botId: number | null
  name: string | null
  worktime: Worktime
  exitOnCollaboratorJoin: boolean
  /** Ausente quando o GPT Maker não respondeu — a lista aparece mesmo assim. */
  vendor?: VendorAgent
}

/** Um imbot desta aplicação no portal do Bitrix. */
export type PortalBot = {
  id: number
  code: string
  name: string
}

export type Bot = PortalBot & {
  /** Id do agente no vendor que usa este bot, ou `null` se ele está livre. */
  boundToAgentId: string | null
  boundToAgentName: string | null
}

export type CreateAgentInput = {
  name: string
  behavior?: string
  jobName?: string
  jobSite?: string
  jobDescription?: string
  communicationType?: CommunicationType
  type?: AgentType
}

/**
 * O baseURL do axios ja termina em /api (NEXT_PUBLIC_API_URL), entao o path
 * comeca no modulo — repetir /api aqui gerava /api/api/gptmaker e 404.
 */
const BASE = '/gptmaker'

function client() {
  return axiosGptMaker()
}

export async function listAgents(): Promise<Agent[]> {
  return (await client().get(`${BASE}/agents`)) as unknown as Agent[]
}

export async function getAgent(gptMakerAgentId: string): Promise<Agent> {
  return (await client().get(
    `${BASE}/agents/${gptMakerAgentId}`,
  )) as unknown as Agent
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  return (await client().post(`${BASE}/agents`, input)) as unknown as Agent
}

export async function deleteAgent(gptMakerAgentId: string): Promise<void> {
  await client().delete(`${BASE}/agents/${gptMakerAgentId}`)
}

export async function updateAgentProfile(
  gptMakerAgentId: string,
  patch: Partial<Omit<VendorAgent, 'id'>>,
): Promise<VendorAgent> {
  return (await client().put(
    `${BASE}/agents/${gptMakerAgentId}/profile`,
    patch,
  )) as unknown as VendorAgent
}

export async function updateAgentSettings(
  gptMakerAgentId: string,
  patch: { worktime?: Worktime; exitOnCollaboratorJoin?: boolean },
): Promise<Agent> {
  return (await client().put(
    `${BASE}/agents/${gptMakerAgentId}/settings`,
    patch,
  )) as unknown as Agent
}

/**
 * Os bots desta aplicação no portal, com o agente que usa cada um.
 *
 * A lista vem do portal do Bitrix, não do nosso banco: o cliente pode criar e
 * remover bots pelo painel de lá.
 */
export async function listBots(): Promise<Bot[]> {
  return (await client().get(`${BASE}/bots`)) as unknown as Bot[]
}

export async function createBot(name: string): Promise<PortalBot> {
  return (await client().post(`${BASE}/bots`, {
    name,
  })) as unknown as PortalBot
}

export async function deleteBot(botId: number): Promise<void> {
  await client().delete(`${BASE}/bots/${botId}`)
}

/** Vincula ao agente um bot que já existe no portal. */
export async function bindBot(
  gptMakerAgentId: string,
  botId: number,
): Promise<Agent> {
  return (await client().post(`${BASE}/agents/${gptMakerAgentId}/bot`, {
    botId,
  })) as unknown as Agent
}

export async function unbindBot(gptMakerAgentId: string): Promise<Agent> {
  return (await client().delete(
    `${BASE}/agents/${gptMakerAgentId}/bot`,
  )) as unknown as Agent
}

export function apiErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}
