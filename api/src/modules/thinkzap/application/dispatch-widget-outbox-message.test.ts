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
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import {
  RELEASE_SCRIPT,
  RESERVE_SCRIPT,
  RedisDailySendQuota,
} from '@/modules/thinkzap/infra/queue/redis-daily-send-quota'

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
  kind: 'TEXT',
  templateName: null,
  templateLanguage: null,
  templateParameters: null,
  templateButtonParameters: null,
  templateHeaderImageUrl: null,
  buttonPayload: null,
  status: 'PENDING',
  providerMessageId: null,
  timelineNotifiedAt: null,
  attempts: 0,
  lastError: null,
  operatorBitrixUserId: '7',
  smsSenderCode: null,
  smsMessageId: null,
  createdAt: new Date('2026-08-14T12:00:00.000Z'),
  sentAt: null,
  ...overrides,
})

const line = {
  provider: ConnectorProvider.ZAPI,
  instanceId: 'Z-1',
  zApiToken: 'TOKEN-SECRETO',
}

/** A linha oficial: template só sai por HubMessage, e por canal. */
const hubLine = {
  provider: ConnectorProvider.HUBMESSAGE,
  instanceId: 'C-9',
  channelId: 'C-9',
}

/** A intenção de template como `EnqueueWidgetTemplateUseCase` a grava. */
const templateRow = (overrides: Partial<WidgetOutboxRecord> = {}) =>
  row({
    kind: 'TEMPLATE',
    text: 'Olá Maria, pedido 1234 saiu.',
    templateName: 'order_update',
    templateLanguage: 'pt_BR',
    templateParameters: ['Maria', '1234'],
    ...overrides,
  })

/** A intenção de botão como `EnqueueInteractiveButtonSendService` a grava. */
const buttonRow = (overrides: Partial<WidgetOutboxRecord> = {}) =>
  row({
    kind: 'INTERACTIVE_BUTTON',
    text: 'Como podemos ajudar?',
    buttonPayload: {
      body: 'Como podemos ajudar?',
      buttons: [{ id: '1', label: 'Site', type: 'URL', url: 'https://x.io' }],
    },
    ...overrides,
  })

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

  const sendTemplate = vi.fn().mockResolvedValue({ messageId: 'tpl-1' })
  const templateSenderResolver = {
    resolve: vi.fn().mockReturnValue({
      supportsTemplateSend: true,
      send: sendTemplate,
    }),
  }

  const sendInteractiveButton = vi
    .fn()
    .mockResolvedValue({ messageId: 'btn-1' })
  const interactiveButtonSenderResolver = {
    resolve: vi.fn().mockReturnValue({ send: sendInteractiveButton }),
  }

  const messages = { create: vi.fn().mockResolvedValue(undefined) }
  const openChannelQueue = { enqueue: vi.fn().mockResolvedValue(undefined) }

  const release = vi.fn().mockResolvedValue(undefined)
  const acquireLock = vi.fn().mockResolvedValue({ release })

  const notifyOutcome = vi.fn().mockResolvedValue(undefined)
  const notifySent = vi.fn().mockResolvedValue(undefined)

  /** Substitui o preparo real: prefixa quando a linha pede, como ele faria. */
  const prepareOutboundText = vi.fn(
    (input: {
      text: string
      settings: { prefixOperatorNameEnabled: boolean }
    }) =>
      Promise.resolve(
        input.settings.prefixOperatorNameEnabled
          ? `João Vitor: ${input.text}`
          : input.text,
      ),
  )

  const sut = new DispatchWidgetOutboxMessage({
    outbox: outbox as never,
    senderResolver: senderResolver as never,
    templateSenderResolver: templateSenderResolver as never,
    interactiveButtonSenderResolver: interactiveButtonSenderResolver as never,
    messages: messages as never,
    openChannelQueue,
    acquireLock,
    notifyOutcome,
    notifySent,
    prepareOutboundText: prepareOutboundText as never,
  })

  return {
    sut,
    outbox,
    send,
    senderResolver,
    sendTemplate,
    templateSenderResolver,
    sendInteractiveButton,
    interactiveButtonSenderResolver,
    messages,
    openChannelQueue,
    acquireLock,
    release,
    notifyOutcome,
    notifySent,
    prepareOutboundText,
    dispatch: (isLastAttempt = false) =>
      sut.execute({ outboxId: 'outbox-1', line, isLastAttempt }),
    dispatchTemplate: (isLastAttempt = false) =>
      sut.execute({ outboxId: 'outbox-1', line: hubLine, isLastAttempt }),
    dispatchButton: (isLastAttempt = false) =>
      sut.execute({ outboxId: 'outbox-1', line, isLastAttempt }),
    dispatchWithLine: (target: typeof line) =>
      sut.execute({ outboxId: 'outbox-1', line: target, isLastAttempt: false }),
  }
}

/** Linha com os toggles resolvidos, como o worker os entrega. */
const lineWithPrefix = (prefixOperatorNameEnabled: boolean) => ({
  ...line,
  appId: 'installed-1',
  settings: {
    prefixOperatorNameEnabled,
    messageUpdateEventEnabled: false,
    messageDeleteEventEnabled: false,
    widgetOpenChannelEnabled: false,
  },
})

describe('DispatchWidgetOutboxMessage', () => {
  beforeEach(() => vi.clearAllMocks())

  /**
   * O prefixo é do **contato**. `row.text` alimenta o espelho no canal aberto, o
   * comentário de timeline e o aviso de falha — nos três o autor já é conhecido.
   */
  describe('prefixo de nome do operador', () => {
    it('prefixa a chamada ao provider quando a linha pede', async () => {
      const sut = makeSut()

      await sut.dispatchWithLine(lineWithPrefix(true))

      expect(sut.send).toHaveBeenCalledWith({
        kind: 'text',
        text: 'João Vitor: Olá',
      })
      const call = sut.prepareOutboundText.mock.calls[0]?.[0]
      expect(call?.text).toBe('Olá')
      expect(call?.settings.prefixOperatorNameEnabled).toBe(true)
      expect(sut.prepareOutboundText).toHaveBeenCalledWith(
        expect.objectContaining({ operatorUserId: '7', appId: 'installed-1' }),
      )
    })

    it('entrega o texto cru quando o toggle está desligado', async () => {
      const sut = makeSut()

      await sut.dispatchWithLine(lineWithPrefix(false))

      expect(sut.send).toHaveBeenCalledWith({ kind: 'text', text: 'Olá' })
    })

    it('não prepara nada quando a intenção não tem operador', async () => {
      const sut = makeSut(row({ operatorBitrixUserId: null }))

      await sut.dispatchWithLine(lineWithPrefix(true))

      expect(sut.prepareOutboundText).not.toHaveBeenCalled()
      expect(sut.send).toHaveBeenCalledWith({ kind: 'text', text: 'Olá' })
    })

    it('não prepara nada em intenção de template', async () => {
      const sut = makeSut(templateRow())

      await sut.dispatchTemplate()

      expect(sut.prepareOutboundText).not.toHaveBeenCalled()
      expect(sut.sendTemplate).toHaveBeenCalledTimes(1)
    })

    it('mantém o texto cru no histórico e no comentário de timeline', async () => {
      const sut = makeSut()

      await sut.dispatchWithLine(lineWithPrefix(true))

      expect(sut.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Olá' }),
      )
      expect(sut.notifySent).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Olá' }),
      )
    })
  })

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

  /**
   * O template compartilha a intenção durável inteira com o envio livre — marca de
   * entrega, claim condicional, lock por destino, efeitos colaterais. O que estes casos
   * fixam é a **única** diferença: qual sender é chamado e com o quê.
   */
  describe('template', () => {
    it('chama o sender de template, e não o de mensagem livre', async () => {
      const sut = makeSut(templateRow())

      const result = await sut.dispatchTemplate()

      expect(sut.send).not.toHaveBeenCalled()
      expect(sut.sendTemplate).toHaveBeenCalledWith({
        templateName: 'order_update',
        language: 'pt_BR',
        bodyParameters: ['Maria', '1234'],
        buttonParameters: [],
      })
      expect(result).toEqual({ status: 'sent', providerMessageId: 'tpl-1' })
    })

    it('reprocessamento reenvia os mesmos valores de botão gravados na row', async () => {
      const buttons = [{ index: 1, subType: 'URL' as const, value: 'PED-1' }]
      const sut = makeSut(
        templateRow({ templateButtonParameters: buttons, attempts: 1 }),
      )

      await sut.dispatchTemplate()

      expect(sut.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ buttonParameters: buttons }),
      )
    })

    it('reprocessamento reenvia a mesma imagem de cabeçalho gravada na row', async () => {
      const sut = makeSut(
        templateRow({
          templateHeaderImageUrl: 'https://loja.com/a.png',
          attempts: 1,
        }),
      )

      await sut.dispatchTemplate()

      expect(sut.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ headerImageUrl: 'https://loja.com/a.png' }),
      )
    })

    it('resolve o sender pelo canal da linha e pelo destino', async () => {
      const sut = makeSut(templateRow())

      await sut.dispatchTemplate()

      expect(sut.templateSenderResolver.resolve).toHaveBeenCalledWith(
        'HUBMESSAGE',
        { channelId: 'C-9', recipientIdentifier: '5511999999999' },
      )
    })

    /** Linha antiga tem só o `instanceId`; o provisionamento novo grava os dois. */
    it('usa o instanceId como canal quando a linha não tem channelId', async () => {
      const sut = makeSut(templateRow())

      await sut.sut.execute({
        outboxId: 'outbox-1',
        line: { provider: ConnectorProvider.HUBMESSAGE, instanceId: 'C-9' },
        isLastAttempt: false,
      })

      expect(sut.templateSenderResolver.resolve).toHaveBeenCalledWith(
        'HUBMESSAGE',
        expect.objectContaining({ channelId: 'C-9' }),
      )
    })

    it('template sem variável envia com lista vazia de parâmetros', async () => {
      const sut = makeSut(templateRow({ templateParameters: null }))

      await sut.dispatchTemplate()

      expect(sut.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ bodyParameters: [] }),
      )
    })

    /**
     * O corpo **resolvido** é o que o histórico e a conversa do canal aberto guardam —
     * o provider recebeu o par (template, parâmetros), e reconstruir o texto depois
     * exigiria consultar o catálogo da Meta a cada leitura.
     */
    it('persiste e enfileira a conversa com o corpo resolvido', async () => {
      const sut = makeSut(templateRow())

      await sut.dispatchTemplate()

      expect(sut.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerMessageId: 'tpl-1',
          type: 'TEXT',
          text: 'Olá Maria, pedido 1234 saiu.',
        }),
      )
      expect(sut.openChannelQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Olá Maria, pedido 1234 saiu.' }),
      )
    })

    /**
     * A garantia que vale mais no template: a Meta cobra por envio, então uma segunda
     * chamada não é só mensagem repetida no telefone do contato — é cobrança repetida.
     */
    it('NÃO chama o provider quando a intenção já tem marca de entrega', async () => {
      const sut = makeSut(
        templateRow({ status: 'SENT', providerMessageId: 'tpl-1' }),
      )

      const result = await sut.dispatchTemplate()

      expect(sut.sendTemplate).not.toHaveBeenCalled()
      expect(result).toEqual({ status: 'resumed', providerMessageId: 'tpl-1' })
    })

    /**
     * Estado impossível pelo caminho normal, e terminal quando acontece: nenhuma das
     * três tentativas faria o nome do template aparecer na row.
     */
    it.each([
      ['sem templateName', { templateName: null }],
      ['sem language', { templateLanguage: null }],
    ] as const)(
      'recusa intenção de template %s antes do lock, como FAILED',
      async (_label, overrides) => {
        const sut = makeSut(templateRow(overrides))

        const result = await sut.dispatchTemplate()

        expect(result).toEqual({ status: 'failed' })
        expect(sut.acquireLock).not.toHaveBeenCalled()
        expect(sut.outbox.claimForSending).not.toHaveBeenCalled()
        expect(sut.sendTemplate).not.toHaveBeenCalled()
        expect(sut.notifyOutcome).toHaveBeenCalledWith(
          'failed',
          expect.objectContaining({ id: 'outbox-1' }),
        )
      },
    )

    /** A classificação da falha é a mesma dos dois caminhos — nada de específico aqui. */
    it('recusa com resposta do provider devolve a intenção para PENDING e relança', async () => {
      const sut = makeSut(templateRow())
      sut.sendTemplate.mockRejectedValue(refusedError())

      await expect(sut.dispatchTemplate(false)).rejects.toThrow()
      expect(sut.outbox.releaseToPending).toHaveBeenCalled()
      expect(sut.release).toHaveBeenCalledTimes(1)
    })

    it('falha sem resposta do provider vira unknown, sem reenviar', async () => {
      const sut = makeSut(templateRow())
      sut.sendTemplate.mockRejectedValue(indeterminateError())

      const result = await sut.dispatchTemplate()

      expect(result).toEqual({ status: 'unknown' })
      expect(sut.outbox.markUnknown).toHaveBeenCalled()
    })
  })

  describe('botão', () => {
    it('chama o sender de botões, e não o de mensagem livre ou de template', async () => {
      const sut = makeSut(buttonRow())

      const result = await sut.dispatchButton()

      expect(sut.send).not.toHaveBeenCalled()
      expect(sut.sendTemplate).not.toHaveBeenCalled()
      expect(sut.sendInteractiveButton).toHaveBeenCalledWith({
        body: 'Como podemos ajudar?',
        buttons: [{ id: '1', label: 'Site', type: 'URL', url: 'https://x.io' }],
      })
      expect(result).toEqual({ status: 'sent', providerMessageId: 'btn-1' })
    })

    it('resolve o sender pela instância/token Z-API da linha e pelo destino', async () => {
      const sut = makeSut(buttonRow())

      await sut.dispatchButton()

      expect(sut.interactiveButtonSenderResolver.resolve).toHaveBeenCalledWith(
        'ZAPI',
        {
          channelId: 'Z-1',
          instanceId: 'Z-1',
          instanceToken: 'TOKEN-SECRETO',
          recipientIdentifier: '5511999999999',
        },
      )
    })

    it('persiste a mensagem entregue com type INTERACTIVE_BUTTON', async () => {
      const sut = makeSut(buttonRow())

      await sut.dispatchButton()

      expect(sut.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerMessageId: 'btn-1',
          type: 'INTERACTIVE_BUTTON',
          text: 'Como podemos ajudar?',
        }),
      )
    })

    it('NÃO chama o provider quando a intenção já tem marca de entrega', async () => {
      const sut = makeSut(
        buttonRow({ status: 'SENT', providerMessageId: 'btn-1' }),
      )

      const result = await sut.dispatchButton()

      expect(sut.sendInteractiveButton).not.toHaveBeenCalled()
      expect(result).toEqual({ status: 'resumed', providerMessageId: 'btn-1' })
    })

    /**
     * Estado impossível pelo caminho normal, e terminal quando acontece —
     * mirror do guard equivalente de template.
     */
    it('recusa intenção de botão sem buttonPayload antes do lock, como FAILED', async () => {
      const sut = makeSut(buttonRow({ buttonPayload: null }))

      const result = await sut.dispatchButton()

      expect(result).toEqual({ status: 'failed' })
      expect(sut.acquireLock).not.toHaveBeenCalled()
      expect(sut.outbox.claimForSending).not.toHaveBeenCalled()
      expect(sut.sendInteractiveButton).not.toHaveBeenCalled()
      expect(sut.notifyOutcome).toHaveBeenCalledWith(
        'failed',
        expect.objectContaining({ id: 'outbox-1' }),
      )
    })

    it('recusa com resposta do provider devolve a intenção para PENDING e relança', async () => {
      const sut = makeSut(buttonRow())
      sut.sendInteractiveButton.mockRejectedValue(refusedError())

      await expect(sut.dispatchButton(false)).rejects.toThrow()
      expect(sut.outbox.releaseToPending).toHaveBeenCalled()
      expect(sut.release).toHaveBeenCalledTimes(1)
    })

    it('falha sem resposta do provider vira unknown, sem reenviar', async () => {
      const sut = makeSut(buttonRow())
      sut.sendInteractiveButton.mockRejectedValue(indeterminateError())

      const result = await sut.dispatchButton()

      expect(result).toEqual({ status: 'unknown' })
      expect(sut.outbox.markUnknown).toHaveBeenCalled()
    })
  })
})

describe('DispatchWidgetOutboxMessage limite diário', () => {
  /** Redis em memória com a semântica dos scripts da cota (ver o teste do adapter). */
  function memoryQuota() {
    const store = new Map<string, number>()
    const redis = {
      eval: (script: string, _n: number, ...args: string[]) => {
        if (script === RESERVE_SCRIPT) {
          const [sentKey, extraKey, enabled, limit] = args as [
            string,
            string,
            string,
            string,
          ]
          const sent = store.get(sentKey) ?? 0
          const extra = store.get(extraKey) ?? 0
          if (enabled === '1' && sent >= Number(limit) + extra) {
            return Promise.resolve([0, sent, extra])
          }
          store.set(sentKey, sent + 1)
          return Promise.resolve([1, sent + 1, extra])
        }
        if (script === RELEASE_SCRIPT) {
          const [sentKey] = args as [string]
          store.set(sentKey, Math.max(0, (store.get(sentKey) ?? 0) - 1))
          return Promise.resolve(0)
        }
        throw new Error('script inesperado')
      },
      mget: (...keys: string[]) =>
        Promise.resolve(keys.map(key => String(store.get(key) ?? 0))),
    }
    const quota = new RedisDailySendQuota(redis as never)
    const sentToday = async (channelId: string) =>
      (await quota.usage(channelId, new Date())).sent
    return { quota, sentToday, store }
  }

  function makeLimitedSut(record: WidgetOutboxRecord) {
    const { quota, sentToday } = memoryQuota()
    const outbox = {
      findById: vi.fn().mockResolvedValue(record),
      claimForSending: vi.fn().mockResolvedValue(true),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      markUnknown: vi.fn().mockResolvedValue(undefined),
      releaseToPending: vi.fn().mockResolvedValue(undefined),
      markTimelineNotified: vi.fn().mockResolvedValue(undefined),
    }
    const send = vi
      .fn()
      .mockResolvedValue({ messageId: 'msg-1', persistedType: 'TEXT' })
    const sendTemplate = vi.fn().mockResolvedValue({ messageId: 'tpl-1' })
    const notifyOutcome = vi.fn().mockResolvedValue(undefined)
    const reportSmsStatus = vi.fn().mockResolvedValue(undefined)

    const sut = new DispatchWidgetOutboxMessage({
      outbox: outbox as never,
      senderResolver: { resolve: vi.fn().mockReturnValue({ send }) } as never,
      templateSenderResolver: {
        resolve: vi.fn().mockReturnValue({ send: sendTemplate }),
      } as never,
      interactiveButtonSenderResolver: { resolve: vi.fn() } as never,
      messages: { create: vi.fn().mockResolvedValue(undefined) } as never,
      openChannelQueue: { enqueue: vi.fn().mockResolvedValue(undefined) },
      acquireLock: vi
        .fn()
        .mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) }),
      notifyOutcome,
      notifySent: vi.fn().mockResolvedValue(undefined),
      reportSmsStatus,
      quota,
    })

    const zapiLineWith = (dailyLimitEnabled: boolean, dailyLimit: number) => ({
      ...line,
      settings: {
        ...DEFAULT_CONNECTOR_SETTINGS,
        dailyLimitEnabled,
        dailyLimit,
      },
    })

    return {
      sut,
      outbox,
      send,
      sendTemplate,
      notifyOutcome,
      reportSmsStatus,
      sentToday,
      dispatch: (target: object, isLastAttempt = false) =>
        sut.execute({
          outboxId: record.id,
          line: target as never,
          isLastAttempt,
        }),
      zapiLineWith,
    }
  }

  beforeEach(() => vi.clearAllMocks())

  it('limite desligado: envio bem-sucedido incrementa a contagem do dia', async () => {
    const sut = makeLimitedSut(row())

    const result = await sut.dispatch(sut.zapiLineWith(false, 300))

    expect(result.status).toBe('sent')
    expect(await sut.sentToday('Z-1')).toBe(1)
  })

  it('linha oficial não toca no contador', async () => {
    const sut = makeLimitedSut(templateRow())

    const result = await sut.dispatch(hubLine)

    expect(result.status).toBe('sent')
    expect(await sut.sentToday('C-9')).toBe(0)
  })

  it('mensagem já na fila quando a última vaga foi consumida: FAILED sem retentativa e aviso na timeline', async () => {
    const sut = makeLimitedSut(row())
    const limited = sut.zapiLineWith(true, 1)

    // Outra mensagem consome a única vaga do dia antes desta ser despachada.
    expect((await sut.dispatch(limited)).status).toBe('sent')
    sut.send.mockClear()

    const result = await sut.dispatch(limited)

    expect(result).toEqual({ status: 'failed' })
    expect(sut.send).not.toHaveBeenCalled()
    expect(sut.outbox.markFailed).toHaveBeenCalledWith(
      'outbox-1',
      expect.stringContaining('limite diário'),
    )
    expect(sut.outbox.releaseToPending).not.toHaveBeenCalled()
    expect(sut.notifyOutcome).toHaveBeenCalledWith(
      'daily-limit',
      expect.objectContaining({ id: 'outbox-1' }),
    )
    expect(await sut.sentToday('Z-1')).toBe(1)
  })

  it('Campanha de SMS recusada pelo limite reporta failed ao Bitrix24', async () => {
    const sut = makeLimitedSut(
      row({ smsSenderCode: 'thinkzap_sms', smsMessageId: 'sms-1' }),
    )
    const limited = sut.zapiLineWith(true, 1)
    await sut.dispatch(limited)
    sut.reportSmsStatus.mockClear()

    await sut.dispatch(limited)

    expect(sut.reportSmsStatus).toHaveBeenCalledWith(
      expect.objectContaining({ smsMessageId: 'sms-1' }),
      'failed',
    )
  })

  it('recusa com resposta do provider devolve a vaga', async () => {
    const sut = makeLimitedSut(row())
    sut.send.mockRejectedValueOnce(refusedError())

    await expect(sut.dispatch(sut.zapiLineWith(true, 5))).rejects.toThrow()

    expect(await sut.sentToday('Z-1')).toBe(0)
  })

  it('falha sem resposta mantém a vaga contada', async () => {
    const sut = makeLimitedSut(row())
    sut.send.mockRejectedValueOnce(indeterminateError())

    const result = await sut.dispatch(sut.zapiLineWith(true, 5))

    expect(result).toEqual({ status: 'unknown' })
    expect(await sut.sentToday('Z-1')).toBe(1)
  })
})
