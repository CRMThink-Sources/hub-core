import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsertMock, createMock, updateMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('@/config/prisma.js', () => ({
  prisma: {
    thinkzapMessage: {
      upsert: upsertMock,
      create: createMock,
      update: updateMock,
    },
  },
}))

import { PrismaThinkzapMessageRepository } from './prisma-thinkzap-message.repository'

const sut = () => new PrismaThinkzapMessageRepository()

type UpsertArgs = {
  where: Record<string, unknown>
  create: Record<string, unknown>
  update: Record<string, unknown>
}

/** Os argumentos do upsert, tipados — `mock.calls` é `any`. */
const upsertArgs = (index = 0): UpsertArgs =>
  upsertMock.mock.calls[index]?.[0] as UpsertArgs

/** O `update` que o upsert recebeu — é ele que decide o que sobrevive. */
const updatePayload = (): Record<string, unknown> => upsertArgs().update

describe('PrismaThinkzapMessageRepository.create — update parcial', () => {
  beforeEach(() => {
    upsertMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
  })

  /**
   * O caso que quebrou em produção: o widget grava a mensagem com texto, o callback
   * de status regrava sem, e o `update` antigo escrevia `text: input.text ?? null` —
   * apagando o corpo. Aqui o campo ausente simplesmente não entra no `update`.
   */
  it('não toca `text` quando a entrada não traz o campo', async () => {
    await sut().create({
      instanceId: 'inst-1',
      source: 'BITRIX',
      providerMessageId: 'Z-1',
      type: 'TEXT',
    })

    expect(updatePayload()).not.toHaveProperty('text')
  })

  it('limpa `text` quando a entrada traz `null` explícito', async () => {
    await sut().create({
      instanceId: 'inst-1',
      source: 'BITRIX',
      providerMessageId: 'Z-1',
      type: 'TEXT',
      text: null,
    })

    expect(updatePayload()).toMatchObject({ text: null })
  })

  it('grava `text` quando a entrada traz valor', async () => {
    await sut().create({
      instanceId: 'inst-1',
      source: 'BITRIX',
      providerMessageId: 'Z-1',
      type: 'TEXT',
      text: 'Olá',
    })

    expect(updatePayload()).toMatchObject({ text: 'Olá' })
  })

  /**
   * O `chat_id` é o guard de "conversa já aberta". Se um segundo write o zerasse,
   * todo reprocessamento re-postaria a mensagem no canal aberto do cliente.
   */
  it('não toca `chatId` quando a entrada não traz o campo', async () => {
    await sut().create({
      instanceId: 'inst-1',
      source: 'BITRIX',
      providerMessageId: 'Z-1',
      type: 'TEXT',
      text: 'Olá',
    })

    expect(updatePayload()).not.toHaveProperty('chatId')
  })

  it('não toca `fileName` nem `bitrixMessageId` ausentes', async () => {
    await sut().create({
      instanceId: 'inst-1',
      source: 'BITRIX',
      providerMessageId: 'Z-1',
      type: 'DOCUMENT',
    })

    expect(updatePayload()).not.toHaveProperty('fileName')
    expect(updatePayload()).not.toHaveProperty('bitrixMessageId')
  })

  /**
   * O `create` do upsert continua normalizando tudo para `null`: row nova não tem
   * valor anterior a preservar, e a coluna é `nullable`.
   */
  it('mantém o `create` do upsert com todos os campos normalizados', async () => {
    await sut().create({
      instanceId: 'inst-1',
      source: 'BITRIX',
      providerMessageId: 'Z-1',
      type: 'TEXT',
      text: 'Olá',
    })

    expect(upsertArgs().create).toMatchObject({
      instanceId: 'inst-1',
      providerMessageId: 'Z-1',
      bitrixMessageId: null,
      bitrixChatId: null,
      fileName: null,
      chatId: null,
      text: 'Olá',
    })
  })

  it('resolve retentativa pelo upsert, sem violar unique constraint', async () => {
    upsertMock.mockResolvedValue(undefined)

    const input = {
      instanceId: 'inst-1',
      source: 'BITRIX' as const,
      providerMessageId: 'Z-1',
      type: 'TEXT' as const,
      text: 'Olá',
    }

    await sut().create(input)
    await sut().create(input)

    expect(upsertMock).toHaveBeenCalledTimes(2)
    expect(createMock).not.toHaveBeenCalled()
    expect(upsertArgs(1).where).toEqual({
      uq_msg_instance_provider: {
        instanceId: 'inst-1',
        providerMessageId: 'Z-1',
      },
    })
  })

  /**
   * Sem `providerMessageId` a chave do upsert é a do Bitrix, e a mesma regra vale:
   * campo ausente não é sobrescrita.
   */
  it('aplica update parcial também no ramo chaveado por bitrixMessageId', async () => {
    await sut().create({
      instanceId: 'inst-1',
      source: 'BITRIX',
      bitrixMessageId: 'B-1',
      type: 'TEXT',
    })

    expect(upsertArgs().where).toEqual({
      uq_msg_instance_bitrix: { instanceId: 'inst-1', bitrixMessageId: 'B-1' },
    })
    expect(updatePayload()).not.toHaveProperty('text')
    expect(updatePayload()).not.toHaveProperty('chatId')
  })

  it('cai no create simples quando não há nenhuma das duas chaves', async () => {
    await sut().create({
      instanceId: 'inst-1',
      source: 'ZAPI',
      type: 'TEXT',
      text: 'Olá',
    })

    expect(upsertMock).not.toHaveBeenCalled()
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})

describe('PrismaThinkzapMessageRepository.updateOpenChannelRefs', () => {
  beforeEach(() => {
    updateMock.mockReset()
  })

  /**
   * A sessão do Bitrix vai para `bitrixChatId` e a identidade do contato para
   * `chatId` — os mesmos papéis que o inbound já dá às duas colunas. Antes a abertura
   * pelo widget punha a sessão em `chatId`, invertendo o sentido da coluna.
   */
  it('grava as duas referências, pela chave de provider', async () => {
    await sut().updateOpenChannelRefs('inst-1', 'Z-1', {
      bitrixChatId: '4242',
      chatId: '5547992259475',
    })

    expect(updateMock).toHaveBeenCalledWith({
      where: {
        uq_msg_instance_provider: {
          instanceId: 'inst-1',
          providerMessageId: 'Z-1',
        },
      },
      data: { bitrixChatId: '4242', chatId: '5547992259475' },
    })
  })
})
