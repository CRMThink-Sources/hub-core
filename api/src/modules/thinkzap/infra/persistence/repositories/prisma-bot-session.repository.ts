import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import type { BotFlowGraph } from '@/modules/thinkzap/domain/bot-flow/flow'
import type {
  BotSession,
  BotSessionStatus,
  CreateBotSessionRepository,
  GetActiveBotSessionRepository,
  GetHandedOffBotSessionRepository,
  UpdateBotSessionRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-session.repository'

type Row = {
  id: string
  appId: string
  bitrixChatId: string
  flowId: string
  flowVersion: number
  graph: unknown
  bindingId: string | null
  currentNodeId: string
  vars: unknown
  attempts: number
  status: string
  createdAt: Date
}

function toSession(row: Row): BotSession {
  return {
    id: row.id,
    appId: row.appId,
    bitrixChatId: row.bitrixChatId,
    flowId: row.flowId,
    flowVersion: row.flowVersion,
    graph: row.graph as BotFlowGraph,
    bindingId: row.bindingId,
    currentNodeId: row.currentNodeId,
    /** `vars` é `Json`: row antiga ou escrita externa pode não ser objeto. */
    vars:
      row.vars && typeof row.vars === 'object' && !Array.isArray(row.vars)
        ? (row.vars as Record<string, string>)
        : {},
    attempts: row.attempts,
    status: row.status as BotSessionStatus,
    createdAt: row.createdAt,
  }
}

export class PrismaBotSessionRepository
  implements
    GetActiveBotSessionRepository,
    GetHandedOffBotSessionRepository,
    CreateBotSessionRepository,
    UpdateBotSessionRepository
{
  // `expiresAt > agora` está na consulta, não numa checagem depois: sessão vencida tem de
  // ser indistinguível de inexistente para `advance` recomeçar o fluxo.
  async getActiveByChatId(
    appId: string,
    chatId: string,
  ): Promise<BotSession | null> {
    const row = await prisma.thinkzapBotSession.findFirst({
      where: {
        appId,
        bitrixChatId: chatId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      // MySQL não tem unique parcial: se houver duplicata, a mais nova é a verdadeira.
      orderBy: { createdAt: 'desc' },
    })

    return row ? toSession(row as unknown as Row) : null
  }

  // Sem `expiresAt` na consulta: o prazo é da sessão do bot, e o atendimento humano que
  // começou no handoff dura o que durar — quem decide até quando o bot fica calado é
  // `runBotTurn`, pela data devolvida aqui.
  async handoffAtByChatId(appId: string, chatId: string): Promise<Date | null> {
    const row = await prisma.thinkzapBotSession.findFirst({
      where: { appId, bitrixChatId: chatId, status: 'HANDED_OFF' },
      orderBy: { closedAt: 'desc' },
      select: { closedAt: true },
    })

    return row?.closedAt ?? null
  }

  async create(input: {
    appId: string
    bitrixChatId: string
    flowId: string
    flowVersion: number
    graph: BotFlowGraph
    bindingId: string | null
    currentNodeId: string
    vars: Record<string, string>
    attempts: number
    expiresAt: Date
  }): Promise<BotSession> {
    const row = await prisma.thinkzapBotSession.create({
      data: {
        id: randomUUID(),
        appId: input.appId,
        bitrixChatId: input.bitrixChatId,
        flowId: input.flowId,
        flowVersion: input.flowVersion,
        graph: input.graph as object,
        // Reservado: a coluna existe para evitar reler a assinatura no CRM a cada mensagem
        // (consome `operating` do app). `runBotTurn` ainda não precisa do contexto da linha.
        lineSnapshot: {},
        bindingId: input.bindingId,
        currentNodeId: input.currentNodeId,
        vars: input.vars,
        attempts: input.attempts,
        expiresAt: input.expiresAt,
      },
    })

    return toSession(row as unknown as Row)
  }

  async advance(
    id: string,
    input: {
      currentNodeId: string
      vars: Record<string, string>
      attempts: number
      expiresAt: Date
    },
  ): Promise<void> {
    await prisma.thinkzapBotSession.update({
      where: { id },
      data: {
        currentNodeId: input.currentNodeId,
        vars: input.vars,
        attempts: input.attempts,
        expiresAt: input.expiresAt,
      },
    })
  }

  async close(
    id: string,
    status: Exclude<BotSessionStatus, 'ACTIVE'>,
  ): Promise<void> {
    await prisma.thinkzapBotSession.update({
      where: { id },
      data: { status, closedAt: new Date() },
    })
  }
}
