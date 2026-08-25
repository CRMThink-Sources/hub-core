import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'
import type { LocalAgent } from '@/modules/gptmaker/domain/entities/agent'
import type {
  AgentRepository,
  CreateLocalAgentInput,
  UpdateLocalAgentInput,
} from '@/modules/gptmaker/domain/repositories/agent.repository'
import {
  DEFAULT_WORKTIME,
  type Worktime,
} from '@/modules/gptmaker/domain/value-objects/worktime'

/** A linha como o Prisma a devolve. */
type AgentRow = {
  id: string
  appId: string
  gptMakerAgentId: string
  botId: number | null
  name: string | null
  worktimeEnabled: boolean
  initHour: string | null
  endHour: string | null
  activeDays: unknown
  timezone: string | null
  respondsOnlyOffHours: boolean
  exitOnCollaboratorJoin: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * `active_days` é JSON e portanto pode voltar qualquer coisa — inclusive de uma
 * escrita antiga ou de edição manual no banco. Um dia fora de 0..6 não tem
 * significado e é descartado em vez de virar uma janela que nunca casa.
 */
function toActiveDays(value: unknown): number[] {
  if (!Array.isArray(value)) return []

  return value
    .map(Number)
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
}

function toWorktime(row: AgentRow): Worktime {
  return {
    enabled: row.worktimeEnabled,
    initHour: row.initHour,
    endHour: row.endHour,
    activeDays: toActiveDays(row.activeDays),
    timezone: row.timezone,
    respondsOnlyOffHours: row.respondsOnlyOffHours,
  }
}

function toLocalAgent(row: AgentRow): LocalAgent {
  return {
    id: row.id,
    appId: row.appId,
    gptMakerAgentId: row.gptMakerAgentId,
    botId: row.botId,
    name: row.name,
    worktime: toWorktime(row),
    exitOnCollaboratorJoin: row.exitOnCollaboratorJoin,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class PrismaAgentRepository implements AgentRepository {
  async create(input: CreateLocalAgentInput): Promise<LocalAgent> {
    const row = await prisma.agent.create({
      data: {
        id: randomUUID(),
        appId: input.appId,
        gptMakerAgentId: input.gptMakerAgentId,
        name: input.name,
        ...DEFAULT_WORKTIME_COLUMNS,
      },
    })

    return toLocalAgent(row as AgentRow)
  }

  async listByApp(appId: string): Promise<LocalAgent[]> {
    const rows = await prisma.agent.findMany({
      where: { appId },
      orderBy: { createdAt: 'asc' },
    })

    return rows.map(row => toLocalAgent(row as AgentRow))
  }

  async countByApp(appId: string): Promise<number> {
    return prisma.agent.count({ where: { appId } })
  }

  async findOwned(
    appId: string,
    gptMakerAgentId: string,
  ): Promise<LocalAgent | null> {
    // O `appId` entra no `where`, e não numa checagem depois da leitura: é o
    // que garante que um id de outra instalação simplesmente não retorne.
    const row = await prisma.agent.findFirst({
      where: { appId, gptMakerAgentId },
    })

    return row ? toLocalAgent(row as AgentRow) : null
  }

  async findOwnedByBotId(
    appId: string,
    botId: number,
  ): Promise<LocalAgent | null> {
    const row = await prisma.agent.findFirst({ where: { appId, botId } })

    return row ? toLocalAgent(row as AgentRow) : null
  }

  async update(id: string, input: UpdateLocalAgentInput): Promise<LocalAgent> {
    const row = await prisma.agent.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.botId !== undefined ? { botId: input.botId } : {}),
        ...(input.exitOnCollaboratorJoin !== undefined
          ? { exitOnCollaboratorJoin: input.exitOnCollaboratorJoin }
          : {}),
        ...(input.worktime
          ? {
              worktimeEnabled: input.worktime.enabled,
              initHour: input.worktime.initHour,
              endHour: input.worktime.endHour,
              activeDays: input.worktime.activeDays,
              timezone: input.worktime.timezone,
              respondsOnlyOffHours: input.worktime.respondsOnlyOffHours,
            }
          : {}),
      },
    })

    return toLocalAgent(row as AgentRow)
  }

  async delete(id: string): Promise<void> {
    await prisma.agent.delete({ where: { id } })
  }

  async findByGptMakerAgentId(
    gptMakerAgentId: string,
  ): Promise<LocalAgent | null> {
    const row = await prisma.agent.findUnique({ where: { gptMakerAgentId } })

    return row ? toLocalAgent(row as AgentRow) : null
  }

  async listAll(): Promise<LocalAgent[]> {
    const rows = await prisma.agent.findMany({ orderBy: { createdAt: 'asc' } })

    return rows.map(row => toLocalAgent(row as AgentRow))
  }
}

/** Os defaults de janela na forma das colunas, para a criação. */
const DEFAULT_WORKTIME_COLUMNS = {
  worktimeEnabled: DEFAULT_WORKTIME.enabled,
  initHour: DEFAULT_WORKTIME.initHour,
  endHour: DEFAULT_WORKTIME.endHour,
  activeDays: DEFAULT_WORKTIME.activeDays,
  timezone: DEFAULT_WORKTIME.timezone,
  respondsOnlyOffHours: DEFAULT_WORKTIME.respondsOnlyOffHours,
} as const
