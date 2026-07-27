import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import type {
  ThinkzapMessageSource,
  ThinkzapMessageType,
} from '@/prisma/client'
import type { ThinkzapMessageQuoteInput } from '@/modules/thinkzap/application/build-reply-quote'

export type ThinkzapMessageRecord = {
  id: string
  instanceId: string
  source: 'ZAPI' | 'BITRIX' | 'HUBMESSAGE'
  providerMessageId: string | null
  bitrixMessageId: string | null
  bitrixChatId: string | null
  type:
    | 'TEXT'
    | 'IMAGE'
    | 'VIDEO'
    | 'AUDIO'
    | 'DOCUMENT'
    | 'STICKER'
    | 'CONTACT'
  text: string | null
  fileName: string | null
  chatId: string | null
  createdAt: Date
}

export type CreateThinkzapMessageInput = {
  instanceId: string
  source: 'ZAPI' | 'BITRIX' | 'HUBMESSAGE'
  providerMessageId?: string | null
  bitrixMessageId?: string | null
  bitrixChatId?: string | null
  type:
    | 'TEXT'
    | 'IMAGE'
    | 'VIDEO'
    | 'AUDIO'
    | 'DOCUMENT'
    | 'STICKER'
    | 'CONTACT'
  text?: string | null
  fileName?: string | null
  chatId?: string | null
}

function mapRow(row: {
  id: string
  instanceId: string
  source: ThinkzapMessageSource
  providerMessageId: string | null
  bitrixMessageId: string | null
  bitrixChatId: string | null
  type: ThinkzapMessageType
  text: string | null
  fileName: string | null
  chatId: string | null
  createdAt: Date
}): ThinkzapMessageRecord {
  return {
    id: row.id,
    instanceId: row.instanceId,
    source: row.source as 'ZAPI' | 'BITRIX' | 'HUBMESSAGE',
    providerMessageId: row.providerMessageId,
    bitrixMessageId: row.bitrixMessageId,
    bitrixChatId: row.bitrixChatId,
    type: row.type as
      | 'TEXT'
      | 'IMAGE'
      | 'VIDEO'
      | 'AUDIO'
      | 'DOCUMENT'
      | 'STICKER'
      | 'CONTACT',
    text: row.text,
    fileName: row.fileName,
    chatId: row.chatId,
    createdAt: row.createdAt,
  }
}

export function toQuoteInput(
  record: ThinkzapMessageRecord,
): ThinkzapMessageQuoteInput {
  return {
    type: record.type,
    text: record.text ?? undefined,
    fileName: record.fileName ?? undefined,
    bitrixMessageId: record.bitrixMessageId ?? undefined,
    bitrixChatId: record.bitrixChatId ?? undefined,
  }
}

export class PrismaThinkzapMessageRepository {
  async create(input: CreateThinkzapMessageInput): Promise<void> {
    const id = randomUUID()
    const data = {
      id,
      instanceId: input.instanceId,
      source: input.source as ThinkzapMessageSource,
      providerMessageId: input.providerMessageId ?? null,
      bitrixMessageId: input.bitrixMessageId ?? null,
      bitrixChatId: input.bitrixChatId ?? null,
      type: input.type as ThinkzapMessageType,
      text: input.text ?? null,
      fileName: input.fileName ?? null,
      chatId: input.chatId ?? null,
    }

    if (input.providerMessageId) {
      await prisma.thinkzapMessage.upsert({
        where: {
          uq_msg_instance_provider: {
            instanceId: input.instanceId,
            providerMessageId: input.providerMessageId,
          },
        },
        create: data,
        update: {
          bitrixMessageId: input.bitrixMessageId ?? null,
          bitrixChatId: input.bitrixChatId ?? null,
          text: input.text ?? null,
          fileName: input.fileName ?? null,
          chatId: input.chatId ?? null,
        },
      })
    } else if (input.bitrixMessageId) {
      await prisma.thinkzapMessage.upsert({
        where: {
          uq_msg_instance_bitrix: {
            instanceId: input.instanceId,
            bitrixMessageId: input.bitrixMessageId,
          },
        },
        create: data,
        update: {
          providerMessageId: input.providerMessageId ?? null,
          bitrixChatId: input.bitrixChatId ?? null,
          text: input.text ?? null,
          fileName: input.fileName ?? null,
          chatId: input.chatId ?? null,
        },
      })
    } else {
      await prisma.thinkzapMessage.create({ data })
    }
  }

  async findByProviderMessageId(
    instanceId: string,
    providerMessageId: string,
  ): Promise<ThinkzapMessageRecord | null> {
    const row = await prisma.thinkzapMessage.findUnique({
      where: {
        uq_msg_instance_provider: { instanceId, providerMessageId },
      },
    })
    return row ? mapRow(row) : null
  }

  async findByBitrixMessageId(
    instanceId: string,
    bitrixMessageId: string,
  ): Promise<ThinkzapMessageRecord | null> {
    const row = await prisma.thinkzapMessage.findUnique({
      where: {
        uq_msg_instance_bitrix: { instanceId, bitrixMessageId },
      },
    })
    return row ? mapRow(row) : null
  }

  async updateBitrixMessageId(
    id: string,
    bitrixMessageId: string,
  ): Promise<void> {
    await prisma.thinkzapMessage.update({
      where: { id },
      data: { bitrixMessageId },
    })
  }
}
