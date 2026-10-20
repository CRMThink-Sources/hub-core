import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import type {
  ThinkzapMessageSource,
  ThinkzapMessageType,
} from '@/prisma/client'
import type { ThinkzapMessageQuoteInput } from '@/modules/thinkzap/application/build-reply-quote'

/** Espelho do enum `ThinkzapMessageType` do Prisma, em literais de string. */
export type ThinkzapMessageRecordType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'STICKER'
  | 'CONTACT'
  | 'INTERACTIVE_BUTTON'

export type ThinkzapMessageRecord = {
  id: string
  instanceId: string
  source: 'ZAPI' | 'BITRIX' | 'HUBMESSAGE'
  providerMessageId: string | null
  bitrixMessageId: string | null
  bitrixChatId: string | null
  type: ThinkzapMessageRecordType
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
  type: ThinkzapMessageRecordType
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
    type: row.type as ThinkzapMessageRecordType,
    text: row.text,
    fileName: row.fileName,
    chatId: row.chatId,
    createdAt: row.createdAt,
  }
}

/**
 * Botão vira `TEXT` na citação: `ThinkzapMessageQuoteInputType` não conhece
 * `INTERACTIVE_BUTTON`, e o corpo em `text` já é o suficiente para o preview
 * de uma resposta citando essa mensagem — a citação não precisa saber que a
 * mensagem original tinha botões.
 */
export function toQuoteInput(
  record: ThinkzapMessageRecord,
): ThinkzapMessageQuoteInput {
  return {
    type: record.type === 'INTERACTIVE_BUTTON' ? 'TEXT' : record.type,
    text: record.text ?? undefined,
    fileName: record.fileName ?? undefined,
    bitrixMessageId: record.bitrixMessageId ?? undefined,
    bitrixChatId: record.bitrixChatId ?? undefined,
  }
}

/**
 * Campos que um segundo write pode atualizar, montados **só com o que veio na
 * entrada**.
 *
 * `undefined` não entra no objeto, então a coluna fica como está; `null` explícito
 * entra e limpa. A diferença não é cosmética: o `update` antigo escrevia
 * `campo ?? null` em tudo, e por isso um segundo `create` parcial **apagava** o que
 * o primeiro gravou — foi assim que o callback de status da Z-API zerava o `text`
 * da mensagem que o widget acabara de persistir, quebrando de tabela o quote de
 * reply, que lê `text`.
 *
 * Idempotência aqui significa **converge**, não "sobrescreve com o que o último
 * chamador por acaso sabia".
 */
function buildPartialUpdate(
  input: CreateThinkzapMessageInput,
  fields: ReadonlyArray<keyof UpdatableMessageFields>,
): UpdatableMessageFields {
  const update: UpdatableMessageFields = {}

  for (const field of fields) {
    if (input[field] !== undefined) {
      update[field] = input[field]
    }
  }

  return update
}

/** As colunas que um segundo write pode tocar — chave e `type` ficam de fora. */
type UpdatableMessageFields = {
  providerMessageId?: string | null
  bitrixMessageId?: string | null
  bitrixChatId?: string | null
  text?: string | null
  fileName?: string | null
  chatId?: string | null
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
        update: buildPartialUpdate(input, [
          'bitrixMessageId',
          'bitrixChatId',
          'text',
          'fileName',
          'chatId',
        ]),
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
        update: buildPartialUpdate(input, [
          'providerMessageId',
          'bitrixChatId',
          'text',
          'fileName',
          'chatId',
        ]),
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

  /**
   * A conversa do canal aberto que esta identidade já tem na linha: a row mais
   * recente com `bitrixChatId` gravado, ou `null` quando o contato (ou grupo) nunca
   * chegou ao canal aberto por esta linha.
   *
   * É o critério de "conversa existente" do espelhamento de mensagens enviadas pelo
   * aparelho — mensagem saída do celular não abre conversa nova.
   */
  async findLatestOpenChannelChat(
    instanceId: string,
    chatId: string,
  ): Promise<ThinkzapMessageRecord | null> {
    const row = await prisma.thinkzapMessage.findFirst({
      where: { instanceId, chatId, bitrixChatId: { not: null } },
      orderBy: { createdAt: 'desc' },
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

  /**
   * Grava as duas referências da conversa do canal aberto na mensagem que a abriu: a
   * sessão do Bitrix em `bitrix_chat_id` e a identidade do contato em `chat_id`.
   *
   * **As duas, e nesses papéis, porque é o que o inbound já faz.** Antes a abertura
   * pelo widget gravava a sessão em `chat_id` — a mesma coluna onde o inbound grava a
   * identidade do contato. Dois significados opostos na mesma coluna, e nenhum jeito
   * de descobrir pelo banco sob qual identidade um contato foi registrado, que é
   * exatamente a informação necessária para diagnosticar canal aberto duplicado.
   *
   * Existe em vez de um `create` parcial porque a abertura da conversa não tem o
   * corpo da mensagem em mãos por obrigação — ela recebe o texto **a postar**, que
   * em envio só de anexo é um descritivo, não o que está persistido. Um `create`
   * levaria esse descritivo para a coluna `text`.
   *
   * É `bitrix_chat_id` que faz o guard de "conversa já aberta" funcionar: sem ele
   * gravado, todo reprocessamento re-posta a mesma mensagem no canal do cliente.
   */
  async updateOpenChannelRefs(
    instanceId: string,
    providerMessageId: string,
    refs: { bitrixChatId: string; chatId: string },
  ): Promise<void> {
    await prisma.thinkzapMessage.update({
      where: {
        uq_msg_instance_provider: { instanceId, providerMessageId },
      },
      data: { bitrixChatId: refs.bitrixChatId, chatId: refs.chatId },
    })
  }

  /**
   * Contagem por `(instanceId, source)` dentro do período, para a home de
   * estatísticas. Uma linha por combinação encontrada — quem chama soma por
   * provider/direção, porque o provider de uma linha `BITRIX` (enviada) não vem
   * do registro, só de fora (`resolveInstanceProvider` na `Instance`).
   *
   * `instanceIds` vazio não chama o banco: lista vazia em `IN ()` é consulta sem
   * sentido, e o chamador (domínio sem nenhuma linha reconhecida) já sabe que o
   * resultado é zero.
   */
  async countByInstanceAndSource(params: {
    instanceIds: string[]
    from: Date
    to: Date
  }): Promise<
    { instanceId: string; source: ThinkzapMessageSource; count: number }[]
  > {
    if (!params.instanceIds.length) return []

    const rows = await prisma.thinkzapMessage.groupBy({
      by: ['instanceId', 'source'],
      where: {
        instanceId: { in: params.instanceIds },
        createdAt: { gte: params.from, lte: params.to },
      },
      _count: { _all: true },
    })

    return rows.map(row => ({
      instanceId: row.instanceId,
      source: row.source,
      count: row._count._all,
    }))
  }
}
