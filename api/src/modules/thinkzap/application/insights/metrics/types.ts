/**
 * Campos de métricas de mensagem presentes em toda sessão (forma de `msgFields`
 * do original). Ficam num tipo próprio para o mesmo cálculo servir ao REST
 * clássico e à Vibe API.
 */
export type MessageFields = {
  initiatedBy: 'client' | 'company' | null
  msgsOperator: number
  msgsClient: number
  msgsBot: number
  replyTimes: number[]
  clientReplied: boolean | null
  firstOperatorAt: string | null
  firstClientAt: string | null
  lastOperatorAt: string | null
  acceptedAt: string | null
}

/** Sessão de atendimento (conversa) no formato normalizado do Insights. */
export type InsightsSession = MessageFields & {
  id: number
  configId: number | null
  source: string
  line: string | null
  operatorId: number | null
  userCode: string
  chatId: number | null
  dateCreate: string
  dateClose: string | null
  status: string
  closeReason: string | null
  vote: string
  crmEntityType: string | null
  crmEntityId: number | null
  queueTransfers: number
  waitAnswer: number | null
  waitClose: number | null
  messageCount: number
}

/** Operador com status ao vivo (`/openlines/operators` da Vibe API). */
export type LiveOperator = {
  userId: number
  configId: number
  status: string
  activeSessions?: number
}

/** Negócio ligado às conversas; stageSemanticId: P (andamento), S (ganho), F (perdido). */
export type InsightsDeal = {
  id: number
  title: string
  stageSemanticId: string
  amount: number
  currency: string
  createdAt: string
  contactId: number | null
  leadId: number | null
}
