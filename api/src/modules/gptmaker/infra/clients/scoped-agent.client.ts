import type { LocalAgent } from '@/modules/gptmaker/domain/entities/agent'
import type {
  UpdateAgentProfileInput,
  VendorAgent,
} from '@/modules/gptmaker/domain/entities/agent'
import type { AgentRepository } from '@/modules/gptmaker/domain/repositories/agent.repository'
import { gptmakerError } from '@/modules/gptmaker/errors/catalog'
import { GptMakerClient } from './gptmaker.client'

/**
 * Um agente cuja posse pela instalação **já foi provada**.
 *
 * Nenhum método recebe `agentId`: o alvo é o agente resolvido na construção, e
 * o chamador não tem como apontar para outro. É essa ausência de parâmetro que
 * torna o isolamento estrutural em vez de uma checagem que cada controller
 * precisaria lembrar de fazer — e são dezenas de rotas com `:agentId`.
 */
export class ScopedAgentClient {
  constructor(
    /** A linha local do agente, já resolvida e conferida. */
    readonly local: LocalAgent,
    private readonly client: GptMakerClient,
  ) {}

  get gptMakerAgentId(): string {
    return this.local.gptMakerAgentId
  }

  async fetch(): Promise<VendorAgent | null> {
    return this.client.getAgent(this.local.gptMakerAgentId)
  }

  async update(patch: UpdateAgentProfileInput): Promise<VendorAgent> {
    return this.client.updateAgent(this.local.gptMakerAgentId, patch)
  }

  async remove(): Promise<void> {
    return this.client.deleteAgent(this.local.gptMakerAgentId)
  }
}

/**
 * Resolve a posse e devolve o cliente escopado — a **única** porta de acesso a
 * um agente no vendor.
 *
 * Falha com `agent.not_found` tanto quando o agente não existe quanto quando
 * existe mas é de outra instalação. Os dois casos são deliberadamente
 * indistinguíveis: separá-los confirmaria a existência do agente alheio a quem
 * não é dono dele, e o workspace é compartilhado.
 *
 * Nenhuma chamada ao vendor acontece antes desta resolução.
 */
export async function forAgent(
  agents: AgentRepository,
  client: GptMakerClient,
  appId: string,
  gptMakerAgentId: string,
): Promise<ScopedAgentClient> {
  const local = await agents.findOwned(appId, gptMakerAgentId)

  if (!local) throw gptmakerError('gptmaker.agent.not_found')

  return new ScopedAgentClient(local, client)
}
