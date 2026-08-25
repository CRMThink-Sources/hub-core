import { axiosGptMaker } from '@/infra/client/axios-gptmaker'

export const MAX_AGENTS = 5

export type CommunicationType = 'FORMAL' | 'NORMAL' | 'RELAXED'
export type AgentType = 'SUPPORT' | 'SALE' | 'PERSONAL'

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

export async function bindBot(
  gptMakerAgentId: string,
  name?: string,
): Promise<Agent> {
  return (await client().post(`${BASE}/agents/${gptMakerAgentId}/bot`, {
    name,
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
