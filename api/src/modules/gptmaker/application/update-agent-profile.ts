import type {
  UpdateAgentProfileInput,
  VendorAgent,
} from '../domain/entities/agent'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import { gptmakerError } from '../errors/catalog'
import type { ScopedAgentClient } from '../infra/clients/scoped-agent.client'

export type UpdateAgentProfileDeps = {
  agents: AgentRepository
}

/**
 * Perfil e trabalho do agente — os campos que vivem no vendor.
 *
 * Lê o agente atual e aplica o patch sobre ele em vez de mandar só os campos
 * recebidos: o `PUT` do vendor substitui o recurso, então enviar um patch
 * parcial apagaria tudo que a tela não mandou. É o mesmo cuidado que o
 * `save-gpt-data` do HubThink tinha ao fazer `{ ...agent, ...data }`.
 */
export async function updateAgentProfile(
  deps: UpdateAgentProfileDeps,
  scoped: ScopedAgentClient,
  patch: UpdateAgentProfileInput,
): Promise<VendorAgent> {
  const current = await scoped.fetch()

  if (!current) throw gptmakerError('gptmaker.agent.not_found')

  const merged = { ...current, ...patch }

  // `id` não é campo editável; mandá-lo de volta no corpo é ruído no melhor
  // caso e recusa no pior.
  delete (merged as Partial<VendorAgent>).id

  const updated = await scoped.update(merged)

  // O espelho local só existe para a lista não custar uma chamada por agente.
  // Se o nome mudou, ele precisa acompanhar — senão a lista mente.
  const name = updated.name ?? merged.name ?? null
  if (name !== scoped.local.name) {
    await deps.agents.update(scoped.local.id, { name })
  }

  return updated
}
