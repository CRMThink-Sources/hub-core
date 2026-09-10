import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import type {
  BotFlowBot,
  DeleteBotFlowBotRepository,
  GetBotFlowBotRepository,
  SaveBotFlowBotRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-bot.repository'

export class PrismaBotFlowBotRepository
  implements
    GetBotFlowBotRepository,
    SaveBotFlowBotRepository,
    DeleteBotFlowBotRepository
{
  async getByAppId(appId: string): Promise<BotFlowBot | null> {
    const row = await prisma.thinkzapBotFlowBot.findUnique({
      where: { appId },
    })

    return row
      ? {
          appId: row.appId,
          bitrixBotId: row.bitrixBotId,
          botToken: row.botToken,
          webhookUrl: row.webhookUrl,
        }
      : null
  }

  async save(input: BotFlowBot): Promise<BotFlowBot> {
    const row = await prisma.thinkzapBotFlowBot.upsert({
      where: { appId: input.appId },
      create: {
        id: randomUUID(),
        appId: input.appId,
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

    return {
      appId: row.appId,
      bitrixBotId: row.bitrixBotId,
      botToken: row.botToken,
      webhookUrl: row.webhookUrl,
    }
  }

  async delete(appId: string): Promise<void> {
    // `deleteMany`: apagar o que não existe é sucesso, não erro.
    await prisma.thinkzapBotFlowBot.deleteMany({ where: { appId } })
  }
}
