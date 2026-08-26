import axios, { type AxiosInstance } from 'axios'
import { env } from '@/config/env'
import type {
  CreateAgentInput,
  UpdateAgentProfileInput,
  VendorAgent,
} from '@/modules/gptmaker/domain/entities/agent'
import { gptmakerError } from '@/modules/gptmaker/errors/catalog'
import {
  DEFAULT_AGENT_TYPE,
  DEFAULT_COMMUNICATION_TYPE,
} from '@/modules/gptmaker/gptmaker.constants'

/**
 * Descreve a recusa do vendor com o corpo da resposta.
 *
 * Sem isso o log guarda so "Request failed with status code 400", que nao diz
 * qual campo o GPT Maker recusou e trava a investigacao no ponto em que ela
 * comeca. Mesmo formato do client da HubMessage.
 */
function vendorFailure(method: string, path: string, error: unknown): unknown {
  if (!axios.isAxiosError(error)) return error

  const status = error.response?.status ?? 'sem resposta'
  const body =
    error.response?.data === undefined
      ? ''
      : ` — ${JSON.stringify(error.response.data)}`

  return new Error(
    `GPT Maker: ${method} ${path} falhou com status ${status}${body}`,
    { cause: error },
  )
}

/** A listagem do workspace vem ora como `{ data: [...] }`, ora como array. */
type WorkspaceAgentsResponse = VendorAgent[] | { data?: VendorAgent[] }

/**
 * Transporte para a API do GPT Maker.
 *
 * **Não sai de `infra/`.** A única porta pública do módulo é `forAgent` (ver
 * `scoped-agent.client.ts`): este client aceita qualquer `agentId`, e o
 * workspace é compartilhado por todos os clientes, então quem tiver uma
 * instância dele pode ler, alterar e apagar o agente de qualquer instalação. O
 * teste de arquitetura (`agent-isolation.test.ts`) reprova quem o importe fora
 * da lista autorizada.
 */
export class GptMakerClient {
  private readonly http: AxiosInstance

  constructor() {
    this.http = axios.create({
      baseURL: env.gptMaker.baseUrl,
      headers: { Authorization: `Bearer ${env.gptMaker.apiToken}` },
      timeout: 30_000,
    })
  }

  /**
   * A credencial é de ambiente e compartilhada. Sem ela nada funciona, mas o
   * módulo sobe assim de propósito — o resto do hub-core não deve deixar de
   * subir por causa de uma app mal configurada.
   */
  private assertConfigured(): void {
    if (!env.gptMaker.apiToken || !env.gptMaker.workspaceId) {
      throw gptmakerError('gptmaker.config.credentials_missing')
    }
  }

  async createAgent(input: CreateAgentInput): Promise<VendorAgent> {
    this.assertConfigured()

    const path = `/workspace/${env.gptMaker.workspaceId}/agents`

    try {
      const { data } = await this.http.post<VendorAgent>(path, {
        name: input.name,
        avatar: input.avatar,
        behavior: input.behavior,
        jobName: input.jobName,
        jobSite: input.jobSite,
        jobDescription: input.jobDescription,
        // Obrigatório no vendor: sem `type` a criação volta
        // `400 {"error":"type is required"}`. `communicationType` vai junto
        // porque o mesmo endpoint aceita os dois, e mandar na criação evita
        // um `PUT` extra para o caso comum.
        type: input.type ?? DEFAULT_AGENT_TYPE,
        communicationType:
          input.communicationType ?? DEFAULT_COMMUNICATION_TYPE,
      })

      return data
    } catch (error) {
      throw gptmakerError(
        'gptmaker.agent.create_failed',
        vendorFailure('POST', path, error),
      )
    }
  }

  async getAgent(agentId: string): Promise<VendorAgent | null> {
    this.assertConfigured()

    try {
      const { data } = await this.http.get<VendorAgent>(`/agent/${agentId}`)

      return data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null
      }

      throw gptmakerError(
        'gptmaker.agent.update_failed',
        vendorFailure('GET', `/agent/${agentId}`, error),
      )
    }
  }

  async updateAgent(
    agentId: string,
    patch: UpdateAgentProfileInput,
  ): Promise<VendorAgent> {
    this.assertConfigured()

    try {
      const { data } = await this.http.put<VendorAgent>(
        `/agent/${agentId}`,
        patch,
      )

      return data
    } catch (error) {
      throw gptmakerError(
        'gptmaker.agent.update_failed',
        vendorFailure('PUT', `/agent/${agentId}`, error),
      )
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    this.assertConfigured()

    try {
      await this.http.delete(`/agent/${agentId}`)
    } catch (error) {
      // Agente já inexistente é o estado desejado, não uma falha.
      if (axios.isAxiosError(error) && error.response?.status === 404) return

      throw gptmakerError(
        'gptmaker.agent.delete_failed',
        vendorFailure('DELETE', `/agent/${agentId}`, error),
      )
    }
  }

  /**
   * Todos os agentes do workspace — de **todas** as instalações.
   *
   * Serve só à reconciliação. Nunca é a fonte de uma listagem de tela: quem
   * lista para o cliente é `core_gpt_agents`, filtrado por `appId`.
   */
  async listWorkspaceAgents(): Promise<VendorAgent[]> {
    this.assertConfigured()

    const { data } = await this.http.get<WorkspaceAgentsResponse>(
      `/workspace/${env.gptMaker.workspaceId}/agents`,
    )

    if (Array.isArray(data)) return data

    return data?.data ?? []
  }
}
