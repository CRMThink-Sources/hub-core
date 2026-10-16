import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import type {
  BotFlowBot,
  DeleteBotFlowBotRepository,
  GetBotFlowBotByBitrixIdRepository,
  GetBotFlowBotRepository,
  ListBotFlowBotsRepository,
  SaveBotFlowBotRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-bot.repository'

type Row = {
  appId: string
  flowId: string | null
  bitrixBotId: number
  botToken: string
  webhookUrl: string
}

const toBot = (row: Row): BotFlowBot => ({
  appId: row.appId,
  flowId: row.flowId,
  bitrixBotId: row.bitrixBotId,
  botToken: row.botToken,
  webhookUrl: row.webhookUrl,
})

export class PrismaBotFlowBotRepository
  implements
    GetBotFlowBotRepository,
    GetBotFlowBotByBitrixIdRepository,
    ListBotFlowBotsRepository,
    SaveBotFlowBotRepository,
    DeleteBotFlowBotRepository
{
  async getByFlowId(appId: string, flowId: string): Promise<BotFlowBot | null> {
    const row = await prisma.thinkzapBotFlowBot.findFirst({
      where: { appId, flowId },
    })

    return row ? toBot(row) : null
  }

  async getByBitrixBotId(
    appId: string,
    bitrixBotId: number,
  ): Promise<BotFlowBot | null> {
    const row = await prisma.thinkzapBotFlowBot.findUnique({
      where: { appId_bitrixBotId: { appId, bitrixBotId } },
    })

    return row ? toBot(row) : null
  }

  async listByAppId(appId: string): Promise<BotFlowBot[]> {
    const rows = await prisma.thinkzapBotFlowBot.findMany({ where: { appId } })
    return rows.map(toBot)
  }

  async save(input: BotFlowBot & { flowId: string }): Promise<BotFlowBot> {
    const row = await prisma.thinkzapBotFlowBot.upsert({
      where: { flowId: input.flowId },
      create: {
        id: randomUUID(),
        appId: input.appId,
        flowId: input.flowId,
        bitrixBotId: input.bitrixBotId,
        botToken: input.botToken,
        webhookUrl: input.webhookUrl,
      },
      update: {
        bitrixBotId: input.bitrixBotId,
        botToken: input.botToken,
        webhookUrl: input.webhookUrl,
      },
    })

    return toBot(row)
  }

  async delete(appId: string, bitrixBotId: number): Promise<void> {
    // `deleteMany`: apagar o que não existe é sucesso, não erro.
    await prisma.thinkzapBotFlowBot.deleteMany({
      where: { appId, bitrixBotId },
    })
  }
}
