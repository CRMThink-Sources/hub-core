import type { Worktime } from '../value-objects/worktime'

/**
 * Como o agente se comunica. Vocabulário do vendor.
 */
export type CommunicationType = 'FORMAL' | 'NORMAL' | 'RELAXED'

/**
 * O papel do agente. Vocabulário do vendor.
 */
export type AgentType = 'SUPPORT' | 'SALE' | 'PERSONAL'

/**
 * A parte do agente que é **nossa**: vive em `core_gpt_agents` e não existe no
 * vendor.
 *
 * É esta linha que associa o agente a uma instalação. O workspace do GPT Maker
 * é compartilhado por todos os clientes e o vendor não conhece instalação —
 * sem esta linha, um `gptMakerAgentId` não pertence a ninguém.
 */
export type LocalAgent = {
  id: string
  appId: string
  gptMakerAgentId: string
  /**
   * IMBOT do portal do cliente. `null` = agente sem bot: não recebe mensagem de
   * canal aberto, mas já ocupa recurso no workspace compartilhado.
   */
  botId: number | null
  /**
   * Espelho do nome no vendor, mantido só para montar a lista sem uma chamada
   * ao vendor por agente. Quem responde pelo nome é o vendor.
   */
  name: string | null
  worktime: Worktime
  /** O agente se retira da conversa quando um atendente humano entra. */
  exitOnCollaboratorJoin: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * A parte do agente que é **do vendor**. Não é espelhada no nosso banco (com a
 * exceção deliberada de `name`): duplicar significaria manter dois valores de
 * verdade para o mesmo campo.
 */
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

/**
 * O agente como as telas o consomem: a linha local com a parte do vendor
 * hidratada.
 *
 * `vendor` é opcional porque a listagem sai do banco e a hidratação é por
 * agente: se o vendor estiver fora do ar, a lista ainda aparece, com os
 * agentes que não puderam ser hidratados marcados. Uma indisponibilidade do
 * terceiro não derruba a tela inteira.
 */
export type Agent = LocalAgent & {
  vendor?: VendorAgent
}

/** O que a criação de agente aceita. */
export type CreateAgentInput = {
  name: string
  avatar?: string
  behavior?: string
  jobName?: string
  jobSite?: string
  jobDescription?: string
  communicationType?: CommunicationType
  type?: AgentType
}

/** O que a edição de perfil/trabalho aceita. Tudo opcional: é um patch. */
export type UpdateAgentProfileInput = Partial<Omit<VendorAgent, 'id'>>
