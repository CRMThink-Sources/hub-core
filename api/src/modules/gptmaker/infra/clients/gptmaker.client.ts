import axios, { type AxiosInstance } from 'axios'
import { env } from '@/config/env'
import type {
  CreateAgentInput,
  UpdateAgentProfileInput,
  VendorAgent,
} from '@/modules/gptmaker/domain/entities/agent'
import { gptmakerError } from '@/modules/gptmaker/errors/catalog'

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

    try {
      const { data } = await this.http.post<VendorAgent>(
        `/workspace/${env.gptMaker.workspaceId}/agents`,
        {
          name: input.name,
          avatar: input.avatar,
          behavior: input.behavior,
          jobName: input.jobName,
          jobSite: input.jobSite,
          jobDescription: input.jobDescription,
        },
      )

      return data
    } catch (error) {
      throw gptmakerError('gptmaker.agent.create_failed', error)
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

      throw gptmakerError('gptmaker.agent.update_failed', error)
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
      throw gptmakerError('gptmaker.agent.update_failed', error)
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    this.assertConfigured()

    try {
      await this.http.delete(`/agent/${agentId}`)
    } catch (error) {
      // Agente já inexistente é o estado desejado, não uma falha.
      if (axios.isAxiosError(error) && error.response?.status === 404) return

      throw gptmakerError('gptmaker.agent.delete_failed', error)
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
