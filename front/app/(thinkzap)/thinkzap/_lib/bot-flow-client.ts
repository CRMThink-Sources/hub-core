import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from './thinkzap-client'
import type {
  BotEffect,
  BotFlow,
  BotFlowBinding,
  BotFlowGraph,
  BotFlowSummary,
  FlowIssue,
  SimulationState,
} from '@/shared/thinkzap-bot-flow'

// O interceptor do axios já devolve `response.data.result`, então os tipos abaixo
// descrevem o `result`, não a resposta HTTP.

export type BotFlowApiError = { message: string; issues?: FlowIssue[] }

export class BotFlowRequestError extends Error {
  readonly issues: FlowIssue[]

  constructor(message: string, issues: FlowIssue[] = []) {
    super(message)
    this.name = 'BotFlowRequestError'
    this.issues = issues
  }
}

function client() {
  const resolved = resolveThinkzapClient()
  if (!resolved.ok) throw new BotFlowRequestError(resolved.message)
  return resolved.client
}

/** Preserva `issues`: é o que o editor usa para marcar os cards quebrados. */
function rethrow(error: unknown, fallback: string): never {
  const issues = extractIssues(error)
  throw new BotFlowRequestError(
    thinkzapApiErrorMessage(error, fallback),
    issues,
  )
}

function extractIssues(error: unknown): FlowIssue[] {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response
  ) {
    const data = (error.response as { data?: unknown }).data
    if (data && typeof data === 'object' && 'result' in data) {
      const result = (data as { result?: unknown }).result
      if (result && typeof result === 'object' && 'issues' in result) {
        const issues = (result as { issues?: unknown }).issues
        if (Array.isArray(issues)) return issues as FlowIssue[]
      }
    }
  }
  return []
}

export async function listBotFlows(): Promise<BotFlowSummary[]> {
  try {
    const result = await client().get<{ flows: BotFlowSummary[] }>(
      '/thinkzap/bot-flows',
    )
    return result.flows
  } catch (error) {
    rethrow(error, 'Não foi possível carregar os fluxos.')
  }
}

export async function getBotFlow(
  flowId: string,
): Promise<{ flow: BotFlow; issues: FlowIssue[] }> {
  try {
    return await client().get<{ flow: BotFlow; issues: FlowIssue[] }>(
      `/thinkzap/bot-flows/${flowId}`,
    )
  } catch (error) {
    rethrow(error, 'Não foi possível carregar o fluxo.')
  }
}

export async function createBotFlow(name: string): Promise<BotFlow> {
  try {
    const result = await client().post<{ flow: BotFlow }>(
      '/thinkzap/bot-flows',
      { name },
    )
    return result.flow
  } catch (error) {
    rethrow(error, 'Não foi possível criar o fluxo.')
  }
}

export async function updateBotFlow(
  flowId: string,
  input: { name?: string; graph?: BotFlowGraph },
): Promise<{ flow: BotFlow; issues: FlowIssue[] }> {
  try {
    return await client().patch<{ flow: BotFlow; issues: FlowIssue[] }>(
      `/thinkzap/bot-flows/${flowId}`,
      input,
    )
  } catch (error) {
    rethrow(error, 'Não foi possível salvar o fluxo.')
  }
}

export async function publishBotFlow(flowId: string): Promise<BotFlow> {
  try {
    const result = await client().post<{ flow: BotFlow }>(
      `/thinkzap/bot-flows/${flowId}/publish`,
    )
    return result.flow
  } catch (error) {
    rethrow(error, 'Não foi possível publicar o fluxo.')
  }
}

export async function deleteBotFlow(flowId: string): Promise<void> {
  try {
    await client().delete(`/thinkzap/bot-flows/${flowId}`)
  } catch (error) {
    rethrow(error, 'Não foi possível excluir o fluxo.')
  }
}

export type SimulationTurn = {
  effects: BotEffect[]
  state: SimulationState | null
  awaitingNodeId: string | null
}

export async function simulateBotFlow(input: {
  flowId?: string
  graph?: BotFlowGraph
  state: SimulationState | null
  input: { kind: 'start' } | { kind: 'text'; text: string }
}): Promise<SimulationTurn> {
  try {
    return await client().post<SimulationTurn>(
      '/thinkzap/bot-flows/simulate',
      input,
    )
  } catch (error) {
    rethrow(error, 'Não foi possível simular o fluxo.')
  }
}

/** Canal aberto do portal. `id` é o `CONFIG_ID`, o mesmo que o vínculo grava. */
export type OpenChannel = { id: string; name: string; active: boolean }

// Pela nossa API, não por `BX24.callMethod`: o caminho do browser exigia o script do
// portal carregado e o escopo `imopenlines` no app do cliente.
export async function listOpenChannels(): Promise<OpenChannel[]> {
  try {
    const result = await client().get<{ channels?: OpenChannel[] }>(
      '/thinkzap/openchannels',
    )
    return result.channels ?? []
  } catch (error) {
    rethrow(error, 'Não foi possível listar os canais abertos.')
  }
}

/** Atendente do portal, como o editor de bot precisa dele. */
export type PortalUser = { id: string; name: string; position?: string }

// Mesma razão do `listOpenChannels`: a página do editor não carrega o script do portal,
// então `BX24.callMethod` não existe nela.
export async function searchPortalUsers(search: string): Promise<PortalUser[]> {
  return fetchPortalUsers({ search })
}

/** Um único atendente, para mostrar o nome de quem já está gravado no fluxo. */
export async function getPortalUser(id: string): Promise<PortalUser | null> {
  const users = await fetchPortalUsers({ id })
  return users[0] ?? null
}

async function fetchPortalUsers(
  query: Record<string, string>,
): Promise<PortalUser[]> {
  try {
    const result = await client().get<{ users?: PortalUser[] }>(
      `/thinkzap/portal-users?${new URLSearchParams(query).toString()}`,
    )
    return result.users ?? []
  } catch (error) {
    rethrow(error, 'Não foi possível buscar os atendentes do portal.')
  }
}

export async function listBotFlowBindings(): Promise<BotFlowBinding[]> {
  try {
    const result = await client().get<{ bindings: BotFlowBinding[] }>(
      '/thinkzap/bot-flow-bindings',
    )
    return result.bindings
  } catch (error) {
    rethrow(error, 'Não foi possível carregar os vínculos.')
  }
}

export async function createBotFlowBinding(input: {
  flowId: string
  lineId: string
  priority?: number
  active?: boolean
}): Promise<BotFlowBinding> {
  try {
    const result = await client().post<{ binding: BotFlowBinding }>(
      '/thinkzap/bot-flow-bindings',
      input,
    )
    return result.binding
  } catch (error) {
    rethrow(error, 'Não foi possível vincular o fluxo à linha.')
  }
}

export async function updateBotFlowBinding(
  bindingId: string,
  input: { lineId?: string; priority?: number; active?: boolean },
): Promise<BotFlowBinding> {
  try {
    const result = await client().patch<{ binding: BotFlowBinding }>(
      `/thinkzap/bot-flow-bindings/${bindingId}`,
      input,
    )
    return result.binding
  } catch (error) {
    rethrow(error, 'Não foi possível atualizar o vínculo.')
  }
}

export async function deleteBotFlowBinding(bindingId: string): Promise<void> {
  try {
    await client().delete(`/thinkzap/bot-flow-bindings/${bindingId}`)
  } catch (error) {
    rethrow(error, 'Não foi possível remover o vínculo.')
  }
}
