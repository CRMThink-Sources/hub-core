import { randomUUID } from 'node:crypto'
import { Prisma } from '@/prisma/client'
import { prisma } from '@/config/prisma'
import {
  parseBindingCondition,
  type BindingCondition,
} from '@/modules/thinkzap/domain/bot-flow/binding-condition'
import type {
  BotFlowBinding,
  BotFlowBindingWithFlow,
  CreateBotFlowBindingRepository,
  DeleteBotFlowBindingRepository,
  GetBotFlowBindingByLineRepository,
  GetBotFlowBindingRepository,
  ListBotFlowBindingsRepository,
  UpdateBotFlowBindingRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'

type BindingRow = {
  id: string
  appId: string
  flowId: string
  lineId: string
  priority: number
  active: boolean
  condition: unknown
  createdAt: Date
  updatedAt: Date
}

function mapBinding(row: BindingRow): BotFlowBinding {
  return {
    id: row.id,
    appId: row.appId,
    flowId: row.flowId,
    lineId: row.lineId,
    priority: row.priority,
    active: row.active,
    condition: parseBindingCondition(row.condition),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Três casos: ausente = não mexer, `null` = pega-o-resto, objeto = condição. */
function conditionData(
  condition: BindingCondition | null | undefined,
): { condition: Prisma.InputJsonValue | typeof Prisma.DbNull } | object {
  if (condition === undefined) return {}
  return {
    condition:
      condition === null
        ? Prisma.DbNull
        : (condition as unknown as Prisma.InputJsonValue),
  }
}

export class PrismaBotFlowBindingRepository
  implements
    ListBotFlowBindingsRepository,
    CreateBotFlowBindingRepository,
    UpdateBotFlowBindingRepository,
    DeleteBotFlowBindingRepository,
    GetBotFlowBindingRepository,
    GetBotFlowBindingByLineRepository
{
  async listByAppId(appId: string): Promise<BotFlowBindingWithFlow[]> {
    const rows = await prisma.thinkzapBotFlowBinding.findMany({
      where: { appId },
      orderBy: [{ lineId: 'asc' }, { priority: 'asc' }],
      include: { flow: { select: { name: true, status: true } } },
    })

    return rows.map(row => ({
      ...mapBinding(row),
      flowName: row.flow.name,
      flowStatus: row.flow.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    }))
  }

  async getById(
    appId: string,
    bindingId: string,
  ): Promise<BotFlowBinding | null> {
    const row = await prisma.thinkzapBotFlowBinding.findFirst({
      where: { id: bindingId, appId },
    })
    return row ? mapBinding(row) : null
  }

  async getByLineId(
    appId: string,
    lineId: string,
  ): Promise<BotFlowBinding | null> {
    const row = await prisma.thinkzapBotFlowBinding.findFirst({
      where: { appId, lineId },
    })
    return row ? mapBinding(row) : null
  }

  async create(input: {
    appId: string
    flowId: string
    lineId: string
    priority: number
    active: boolean
    condition: BindingCondition | null
  }): Promise<BotFlowBinding> {
    const row = await prisma.thinkzapBotFlowBinding.create({
      data: {
        id: randomUUID(),
        appId: input.appId,
        flowId: input.flowId,
        lineId: input.lineId,
        priority: input.priority,
        active: input.active,
        ...conditionData(input.condition),
      },
    })
    return mapBinding(row)
  }

  async update(
    appId: string,
    bindingId: string,
    input: {
      lineId?: string
      priority?: number
      active?: boolean
      condition?: BindingCondition | null
    },
  ): Promise<BotFlowBinding> {
    await prisma.thinkzapBotFlowBinding.updateMany({
      where: { id: bindingId, appId },
      data: {
        ...(input.lineId === undefined ? {} : { lineId: input.lineId }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(input.active === undefined ? {} : { active: input.active }),
        ...conditionData(input.condition),
      },
    })

    const row = await prisma.thinkzapBotFlowBinding.findFirstOrThrow({
      where: { id: bindingId, appId },
    })
    return mapBinding(row)
  }

  async delete(appId: string, bindingId: string): Promise<void> {
    await prisma.thinkzapBotFlowBinding.deleteMany({
      where: { id: bindingId, appId },
    })
  }
}
