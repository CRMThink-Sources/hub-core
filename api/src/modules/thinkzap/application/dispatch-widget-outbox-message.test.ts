import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { DispatchWidgetOutboxMessage } from './dispatch-widget-outbox-message'

const row = (
  overrides: Partial<WidgetOutboxRecord> = {},
): WidgetOutboxRecord => ({
  id: 'outbox-1',
  clientMessageId: 'client-1',
  instanceId: 'inst-db-1',
  subscriptionItemId: 'item-1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999999999',
  text: 'Olá',
  entity: 'deal',
  entityId: '42',
  status: 'PENDING',
  providerMessageId: null,
  timelineNotifiedAt: null,
  attempts: 0,
  lastError: null,
  createdAt: new Date('2026-08-14T12:00:00.000Z'),
  sentAt: null,
  ...overrides,
})

const line = {
  provider: ConnectorProvider.ZAPI,
  instanceId: 'Z-1',
  zApiToken: 'TOKEN-SECRETO',
}

/** Erro com resposta HTTP do provider — prova que nada saiu. */
const refusedError = () =>
  new HubMessageApiError(500, 'POST', '/messages', { error: 'boom' }, null)

/** Erro sem resposta — indeterminado, pode ter saído. */
const indeterminateError = () =>
  new HubMessageApiError(undefined, 'POST', '/messages', null, null)

function makeSut(record = row()) {
  const outbox = {
    findById: vi.fn().mockResolvedValue(record),
    claimForSending: vi.fn().mockResolvedValue(true),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markUnknown: vi.fn().mockResolvedValue(undefined),
    releaseToPending: vi.fn().mockResolvedValue(undefined),
    markTimelineNotified: vi.fn().mockResolvedValue(undefined),
  }

  const send = vi.fn().mockResolvedValue({
    messageId: 'msg-1',
    persistedType: 'TEXT',
  })
  const senderResolver = { resolve: vi.fn().mockReturnValue({ send }) }

  const messages = { create: vi.fn().mockResolvedValue(undefined) }
  const openChannelQueue = { enqueue: vi.fn().mockResolvedValue(undefined) }

  const release = vi.fn().mockResolvedValue(undefined)
  const acquireLock = vi.fn().mockResolvedValue({ release })

  const notifyOutcome = vi.fn().mockResolvedValue(undefined)
  const notifySent = vi.fn().mockResolvedValue(undefined)

  const sut = new DispatchWidgetOutboxMessage({
    outbox: outbox as never,
    senderResolver: senderResolver as never,
    messages: messages as never,
    openChannelQueue,
    acquireLock,
    notifyOutcome,
    notifySent,
  })

  return {
    sut,
    outbox,
    send,
    senderResolver,
    messages,
    openChannelQueue,
    acquireLock,
    release,
    notifyOutcome,
    notifySent,
    dispatch: (isLastAttempt = false) =>
      sut.execute({ outboxId: 'outbox-1', line, isLastAttempt }),
  }
}

describe('DispatchWidgetOutboxMessage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('entrega uma intenção pendente e grava a marca de entrega', async () => {
    const sut = makeSut()

    const result = await sut.dispatch()

    expect(sut.send).toHaveBeenCalledWith({ kind: 'text', text: 'Olá' })
    expect(sut.outbox.markSent).toHaveBeenCalledWith('outbox-1', 'msg-1')
    expect(result).toEqual({ status: 'sent', providerMessageId: 'msg-1' })
  })

  it('resolve o sender pelo provider da linha, com o destino como alvo', async () => {
    const sut = makeSut()

    await sut.dispatch()

    expect(sut.senderResolver.resolve).toHaveBeenCalledWith('ZAPI', {
      instanceId: 'Z-1',
      zApiToken: 'TOKEN-SECRETO',
      channelId: null,
      chatId: '5511999999999',
    })
  })

  /**
   * A garantia central da change: com a marca de entrega gravada, nenhuma retentativa
   * pode chamar o provider outra vez. Sem isto, `attempts: 3` entregaria a mensagem
   * três vezes ao contato.
   */
  it('NÃO chama o provider quando a intenção já tem marca de entrega', async () => {
    const sut = makeSut(row({ status: 'SENDING', providerMessageId: 'msg-1' }))

    const result = await sut.dispatch()

    expect(sut.send).not.toHaveBeenCalled()
    expect(sut.acquireLock).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'resumed', providerMessageId: 'msg-1' })
  })

  it('retoma os efeitos colaterais da intenção já entregue', async () => {
    const sut = makeSut(row({ status: 'SENT', providerMessageId: 'msg-1' }))

    await sut.dispatch()

    expect(sut.messages.create).toHaveBeenCalled()
    expect(sut.openChannelQueue.enqueue).toHaveBeenCalled()
  })

  describe('reivindicação', () => {
    it('não envia quando outra execução reivindicou primeiro', async () => {
      const sut = makeSut()
      sut.outbox.claimForSending.mockResolvedValue(false)

      const result = await sut.dispatch()

      expect(sut.send).not.toHaveBeenCalled()
      expect(result).toEqual({
        status: 'skipped',
        reason: 'claimed-by-other',
      })
    })

    /**
     * `SENDING` sem marca: a execução anterior morreu durante a chamada ao provider.
     * Pode ter entregue. Reenviar seria apostar, e o contato paga a aposta errada.
     */
    it('trata SENDING sem marca de entrega como unknown, sem reenviar', async () => {
      const sut = makeSut(row({ status: 'SENDING' }))

      const result = await sut.dispatch()

      expect(sut.send).not.toHaveBeenCalled()
      expect(sut.outbox.markUnknown).toHaveBeenCalled()
      expect(sut.notifyOutcome).toHaveBeenCalledWith(
        'unknown',
        expect.objectContaining({ id: 'outbox-1' }),
      )
      expect(result).toEqual({ status: 'unknown' })
    })

    it.each(['FAILED', 'UNKNOWN'] as const)(
      'não reprocessa intenção em estado terminal (%s)',
      async status => {
        const sut = makeSut(row({ status }))

        const result = await sut.dispatch()

        expect(sut.send).not.toHaveBeenCalled()
        expect(result).toEqual({ status: 'skipped', reason: 'terminal' })
      },
    )

    it('encerra quando a intenção não existe', async () => {
      const sut = makeSut()
      sut.outbox.findById.mockResolvedValue(null)

      const result = await sut.dispatch()

      expect(result).toEqual({ status: 'skipped', reason: 'missing' })
    })
  })

  describe('ordem por destino', () => {
    it('devolve locked sem reivindicar quando o destino está ocupado', async () => {
      const sut = makeSut()
      sut.acquireLock.mockResolvedValue(null)

      const result = await sut.dispatch()

      expect(result).toEqual({ status: 'locked' })
      expect(sut.outbox.claimForSending).not.toHaveBeenCalled()
      expect(sut.send).not.toHaveBeenCalled()
    })

    it('toma o lock pelo par (linha, destino)', async () => {
      const sut = makeSut()

      await sut.dispatch()

      expect(sut.acquireLock).toHaveBeenCalledWith('inst-db-1', '5511999999999')
    })

    it('libera o lock no sucesso', async () => {
      const sut = makeSut()

      await sut.dispatch()

      expect(sut.release).toHaveBeenCalledTimes(1)
    })

    /** Lock não liberado trava o destino inteiro até o TTL — o `finally` existe por isso. */
    it('libera o lock mesmo quando o envio relança para retentativa', async () => {
      const sut = makeSut()
      sut.send.mockRejectedValue(refusedError())

      await expect(sut.dispatch(false)).rejects.toThrow()
      expect(sut.release).toHaveBeenCalledTimes(1)
    })
  })

  describe('classificação da falha', () => {
    /**
     * Recusa com resposta prova que nada saiu — retentar é seguro, e é o que salva a
     * mensagem de um `500` transitório do provider, que é a dor que originou a change.
     */
    it('devolve a intenção para PENDING e relança quando ainda há tentativa', async () => {
      const sut = makeSut()
      sut.send.mockRejectedValue(refusedError())

      await expect(sut.dispatch(false)).rejects.toThrow()
      expect(sut.outbox.releaseToPending).toHaveBeenCalled()
      expect(sut.outbox.markFailed).not.toHaveBeenCalled()
    })

    it('marca failed e avisa o operador na última tentativa', async () => {
      const sut = makeSut()
      sut.send.mockRejectedValue(refusedError())

      const result = await sut.dispatch(true)

      expect(sut.outbox.markFailed).toHaveBeenCalled()
      expect(sut.notifyOutcome).toHaveBeenCalledWith(
        'failed',
        expect.objectContaining({ id: 'outbox-1' }),
      )
      expect(result).toEqual({ status: 'failed' })
    })

    /**
     * Sem resposta do provider a entrega é indeterminada: vira terminal `unknown` já na
     * primeira tentativa, e nunca é reenviada.
     */
    it('vira unknown sem retentar quando não houve resposta do provider', async () => {
      const sut = makeSut()
      sut.send.mockRejectedValue(indeterminateError())

      const result = await sut.dispatch(false)

      expect(sut.outbox.markUnknown).toHaveBeenCalled()
      expect(sut.outbox.releaseToPending).not.toHaveBeenCalled()
      expect(result).toEqual({ status: 'unknown' })
    })
  })

  describe('efeitos colaterais', () => {
    it('persiste a mensagem e enfileira a conversa depois da entrega', async () => {
      const sut = makeSut()

      await sut.dispatch()

      expect(sut.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: 'inst-db-1',
          providerMessageId: 'msg-1',
          type: 'TEXT',
          text: 'Olá',
        }),
      )
      expect(sut.openChannelQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionItemId: 'item-1',
          providerMessageId: 'msg-1',
        }),
      )
    })

    it('publica o comentário de timeline e carimba a idempotência', async () => {
      const sut = makeSut()

      await sut.dispatch()

      expect(sut.notifySent).toHaveBeenCalledTimes(1)
      expect(sut.outbox.markTimelineNotified).toHaveBeenCalledWith('outbox-1')
    })

    /** `crm.timeline.comment.add` não é idempotente — o carimbo é o que segura. */
    it('não republica o comentário quando o carimbo já existe', async () => {
      const sut = makeSut(
        row({
          status: 'SENT',
          providerMessageId: 'msg-1',
          timelineNotifiedAt: new Date('2026-08-14T12:00:01.000Z'),
        }),
      )

      await sut.dispatch()

      expect(sut.notifySent).not.toHaveBeenCalled()
    })

    /**
     * A mensagem já está no telefone do contato: falha de efeito colateral não pode
     * fazer o job falhar, senão o BullMQ retentaria o envio inteiro.
     */
    it('não deixa falha de persistência derrubar o job', async () => {
      const sut = makeSut()
      sut.messages.create.mockRejectedValue(new Error('db down'))

      await expect(sut.dispatch()).resolves.toMatchObject({ status: 'sent' })
    })

    it('não deixa falha de enfileiramento da conversa derrubar o job', async () => {
      const sut = makeSut()
      sut.openChannelQueue.enqueue.mockRejectedValue(new Error('redis down'))

      await expect(sut.dispatch()).resolves.toMatchObject({ status: 'sent' })
    })
  })
})
