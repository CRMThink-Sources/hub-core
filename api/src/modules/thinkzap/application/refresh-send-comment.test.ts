import { describe, expect, it, vi } from 'vitest'
import type {
  PrismaSendNoticeRepository,
  SendNoticeRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-notice.repository'
import type {
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { SendNoticeDeferredError } from '@/modules/thinkzap/domain/errors/send-notice-deferred.error'
import type { TimelineCommentPublisher } from '@/shared/data/contracts/send-notification'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { QUERY_LIMIT_DEFER_MS } from '@/shared/infra/bitrix-limits/limit-errors'
import {
  DAILY_LIMIT_FAILURE,
  MEDIA_EXPIRED_FAILURE,
} from './dispatch-widget-outbox-message'
import {
  refreshSendComment,
  SendCommentClaimLostError,
  type RefreshSendCommentDeps,
} from './refresh-send-comment'

const notice = (
  overrides: Partial<SendNoticeRecord> = {},
): SendNoticeRecord => ({
  id: 'notice-1',
  dispatchKey: 'dispatch-1',
  domainId: 'domain-1',
  appCode: 'thinkzap',
  entity: 'deal',
  entityId: '42',
  operatorBitrixUserId: null,
  eager: false,
  commentId: null,
  commentAsAuthor: false,
  commentClaimedAt: null,
  fromPhone: '5511999990000',
  alertedFailures: 0,
  createdAt: new Date('2026-11-27T10:00:00Z'),
  updatedAt: new Date('2026-11-27T10:00:00Z'),
  ...overrides,
})

const row = (overrides: Partial<WidgetOutboxRecord> = {}): WidgetOutboxRecord =>
  ({
    id: 'row-1',
    destination: '5511888880000',
    text: 'Olá',
    entity: 'deal',
    entityId: '42',
    kind: 'TEXT',
    origin: 'WIDGET',
    status: 'SENT',
    lastError: null,
    deliveredAt: null,
    readAt: null,
    rejectedAt: null,
    failureCode: null,
    failureReason: null,
    partIndex: null,
    dispatchMeta: null,
    fileName: null,
    templateName: null,
    templateLanguage: null,
    operatorBitrixUserId: null,
    ...overrides,
  }) as WidgetOutboxRecord

function setup(input: {
  notice?: SendNoticeRecord | null
  rows?: WidgetOutboxRecord[]
  claim?: boolean
  published?: Awaited<ReturnType<TimelineCommentPublisher['publish']>>
  updated?: boolean
}) {
  const publisher = {
    publish: vi
      .fn<TimelineCommentPublisher['publish']>()
      .mockResolvedValue(
        input.published === undefined
          ? { commentId: '900', asAuthor: false }
          : input.published,
      ),
    update: vi
      .fn<TimelineCommentPublisher['update']>()
      .mockResolvedValue(input.updated ?? true),
  }
  const notices = {
    findById: vi
      .fn<PrismaSendNoticeRepository['findById']>()
      .mockResolvedValue(input.notice === undefined ? notice() : input.notice),
    claimComment: vi
      .fn<PrismaSendNoticeRepository['claimComment']>()
      .mockResolvedValue(input.claim ?? true),
    releaseCommentClaim: vi
      .fn<PrismaSendNoticeRepository['releaseCommentClaim']>()
      .mockResolvedValue(undefined),
    saveComment: vi
      .fn<PrismaSendNoticeRepository['saveComment']>()
      .mockResolvedValue(undefined),
    saveFromPhone: vi
      .fn<PrismaSendNoticeRepository['saveFromPhone']>()
      .mockResolvedValue(undefined),
  }
  const outbox = {
    findBySendNotice: vi
      .fn<PrismaWidgetOutboxRepository['findBySendNotice']>()
      .mockResolvedValue(input.rows ?? [row()]),
  }
  const deps: RefreshSendCommentDeps = {
    notices,
    outbox,
    publisher: vi
      .fn<RefreshSendCommentDeps['publisher']>()
      .mockResolvedValue(publisher),
    locale: vi.fn<RefreshSendCommentDeps['locale']>().mockResolvedValue('pt'),
    fromPhone: vi
      .fn<RefreshSendCommentDeps['fromPhone']>()
      .mockResolvedValue(''),
    now: () => new Date('2026-11-27T10:05:00Z'),
  }
  return { deps, publisher, notices, outbox }
}

const messageOf = (call: unknown[] | undefined) =>
  (call?.[0] as { message: string } | undefined)?.message ?? ''

describe('refreshSendComment', () => {
  it('não publica o aviso preguiçoso com parte pendente', async () => {
    const { deps, publisher, notices } = setup({
      rows: [row({ status: 'PENDING' })],
    })

    await refreshSendComment('notice-1', deps)

    expect(notices.claimComment).not.toHaveBeenCalled()
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('publica o aviso eager pendente com "Aguardando envio"', async () => {
    const { deps, publisher, notices } = setup({
      notice: notice({ eager: true }),
      rows: [row({ status: 'PENDING' })],
    })

    await refreshSendComment('notice-1', deps)

    expect(notices.claimComment).toHaveBeenCalledWith(
      'notice-1',
      new Date('2026-11-27T10:05:00Z'),
    )
    expect(messageOf(publisher.publish.mock.calls[0])).toContain(
      'Aguardando envio',
    )
    expect(notices.saveComment).toHaveBeenCalledWith('notice-1', {
      commentId: '900',
      asAuthor: false,
    })
  })

  it('edita, e não publica, quando o comentário já existe', async () => {
    const { deps, publisher, notices } = setup({
      notice: notice({ commentId: '900', commentAsAuthor: true }),
    })

    await refreshSendComment('notice-1', deps)

    expect(publisher.publish).not.toHaveBeenCalled()
    expect(notices.claimComment).not.toHaveBeenCalled()
    expect(publisher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: '900',
        asAuthor: true,
        entity: 'deal',
        contextId: '42',
      }),
    )
    expect(messageOf(publisher.update.mock.calls[0])).toContain('Enviado')
  })

  it('rejeita sem publicar quando perde a reivindicação', async () => {
    const { deps, publisher } = setup({ claim: false })

    await expect(refreshSendComment('notice-1', deps)).rejects.toBeInstanceOf(
      SendCommentClaimLostError,
    )
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('reivindicação antiga sem comentário: desiste sem lançar', async () => {
    const { deps, publisher } = setup({
      claim: false,
      // `now` do setup é 10:05: a reivindicação tem 3 min.
      notice: notice({ commentClaimedAt: new Date('2026-11-27T10:02:00Z') }),
    })

    await expect(refreshSendComment('notice-1', deps)).resolves.toBeUndefined()
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('reivindicação recente: lança para o job tentar de novo', async () => {
    const { deps } = setup({
      claim: false,
      notice: notice({ commentClaimedAt: new Date('2026-11-27T10:04:00Z') }),
    })

    await expect(refreshSendComment('notice-1', deps)).rejects.toBeInstanceOf(
      SendCommentClaimLostError,
    )
  })

  it('pausa do Bitrix na publicação devolve a reivindicação e adia o job', async () => {
    const { deps, publisher, notices } = setup({})
    const until = new Date('2026-11-27T10:09:00Z').getTime()
    publisher.publish.mockRejectedValue(
      new BitrixMethodPausedError('crm.timeline.comment.add', 'x', until),
    )

    const error: unknown = await refreshSendComment('notice-1', deps).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(SendNoticeDeferredError)
    expect((error as SendNoticeDeferredError).untilMs).toBe(until)
    expect(notices.releaseCommentClaim).toHaveBeenCalledWith('notice-1')
    expect(notices.saveComment).not.toHaveBeenCalled()
  })

  it('limite de intensidade na publicação adia um intervalo fixo', async () => {
    const { deps, publisher, notices } = setup({})
    publisher.publish.mockRejectedValue(
      new Error('Bitrix error: 503 - {"error":"QUERY_LIMIT_EXCEEDED"}'),
    )

    const error: unknown = await refreshSendComment('notice-1', deps).catch(
      (e: unknown) => e,
    )

    expect((error as SendNoticeDeferredError).untilMs).toBe(
      deps.now().getTime() + QUERY_LIMIT_DEFER_MS,
    )
    expect(notices.releaseCommentClaim).toHaveBeenCalledWith('notice-1')
  })

  it('outro erro da publicação sobe sem devolver a reivindicação', async () => {
    const { deps, publisher, notices } = setup({})
    publisher.publish.mockRejectedValue(new Error('inesperado'))

    await expect(refreshSendComment('notice-1', deps)).rejects.toThrow(
      'inesperado',
    )
    expect(notices.releaseCommentClaim).not.toHaveBeenCalled()
  })

  it('pausa do Bitrix na edição adia o job', async () => {
    const { deps, publisher } = setup({
      notice: notice({ commentId: '900' }),
    })
    const until = new Date('2026-11-27T10:09:00Z').getTime()
    publisher.update.mockRejectedValue(
      new BitrixMethodPausedError('crm.timeline.comment.update', 'x', until),
    )

    const error: unknown = await refreshSendComment('notice-1', deps).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(SendNoticeDeferredError)
    expect((error as SendNoticeDeferredError).untilMs).toBe(until)
  })

  it('resolve sem gravar o comentário quando a publicação devolve null', async () => {
    const { deps, notices } = setup({ published: null })

    await expect(refreshSendComment('notice-1', deps)).resolves.toBeUndefined()
    expect(notices.saveComment).not.toHaveBeenCalled()
  })

  it('resolve quando a edição diz que o comentário sumiu', async () => {
    const { deps, publisher } = setup({
      notice: notice({ commentId: '900' }),
      updated: false,
    })

    await expect(refreshSendComment('notice-1', deps)).resolves.toBeUndefined()
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('deixa subir a falha da edição, para o job tentar de novo', async () => {
    const { deps, publisher } = setup({ notice: notice({ commentId: '900' }) })
    publisher.update.mockRejectedValueOnce(new Error('timeout'))

    await expect(refreshSendComment('notice-1', deps)).rejects.toThrow(
      'timeout',
    )
  })

  it('mostra a frase traduzida da recusa 131047', async () => {
    const { deps, publisher } = setup({
      rows: [
        row({
          rejectedAt: new Date('2026-11-27T10:01:00Z'),
          failureCode: '131047',
          failureReason: 'Re-engagement message',
        }),
      ],
    })

    await refreshSendComment('notice-1', deps)

    expect(messageOf(publisher.publish.mock.calls[0])).toContain(
      'a janela de 24 horas desta conversa está fechada',
    )
  })

  it('mostra o motivo do limite diário no destinatário recusado', async () => {
    const { deps, publisher } = setup({
      rows: [
        row({ status: 'FAILED', lastError: DAILY_LIMIT_FAILURE }),
        row({ id: 'row-2', destination: '5511777770000' }),
      ],
    })

    await refreshSendComment('notice-1', deps)

    expect(messageOf(publisher.publish.mock.calls[0])).toContain(
      'esta linha atingiu o limite diário',
    )
  })

  it('lista os arquivos do robô, inclusive os que não saíram do Bitrix', async () => {
    const meta = {
      kind: 'robot-message',
      fromPhone: '5511999991111',
      message: 'Segue o contrato',
      requestedFiles: 2,
      failedFiles: [{ name: 'grande.pdf', reason: 'too_large' }],
      recipients: ['5511888880000'],
      crmDocument: { entity: 'deal', entityId: '42' },
    }
    const { deps, publisher } = setup({
      notice: notice({ fromPhone: null }),
      rows: [
        row({
          origin: 'ROBOT_MESSAGE',
          partIndex: 0,
          dispatchMeta: meta,
          text: 'Segue o contrato',
        }),
        row({
          id: 'row-2',
          origin: 'ROBOT_MESSAGE',
          partIndex: 1,
          kind: 'MEDIA',
          fileName: 'contrato.pdf',
        }),
      ],
    })

    await refreshSendComment('notice-1', deps)

    const message = messageOf(publisher.publish.mock.calls[0])
    expect(message).toContain('contrato.pdf')
    expect(message).toContain('grande.pdf (maior que 30 MB)')
    expect(message).toContain('5511999991111')
    expect(deps.fromPhone).not.toHaveBeenCalled()
  })

  it('grava o telefone de origem obtido da linha', async () => {
    const { deps, notices } = setup({ notice: notice({ fromPhone: null }) })
    vi.mocked(deps.fromPhone).mockResolvedValueOnce('5511999992222')

    await refreshSendComment('notice-1', deps)

    expect(notices.saveFromPhone).toHaveBeenCalledWith(
      'notice-1',
      '5511999992222',
    )
  })

  it('publica em nome de quem enviou', async () => {
    const { deps, publisher } = setup({
      notice: notice({ operatorBitrixUserId: '7' }),
    })

    await refreshSendComment('notice-1', deps)

    const input = publisher.publish.mock.calls[0]?.[0]
    expect(input?.authorBitrixUserId).toBe('7')
    expect(input?.senderLine?.('Ana')).toContain('Ana')
  })

  it('não faz nada sem partes', async () => {
    const { deps, publisher, notices } = setup({ rows: [] })

    await refreshSendComment('notice-1', deps)

    expect(notices.claimComment).not.toHaveBeenCalled()
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('não reivindica quando a releitura das partes falha', async () => {
    const { deps, notices, outbox } = setup({})
    outbox.findBySendNotice
      .mockResolvedValueOnce([row()])
      .mockRejectedValueOnce(new Error('db fora'))

    await expect(refreshSendComment('notice-1', deps)).rejects.toThrow(
      'db fora',
    )
    expect(notices.claimComment).not.toHaveBeenCalled()
  })

  it('monta o comentário com a releitura das partes', async () => {
    const { deps, publisher, outbox } = setup({})
    outbox.findBySendNotice
      .mockResolvedValueOnce([row({ status: 'SENT' })])
      .mockResolvedValueOnce([
        row({ status: 'FAILED', lastError: 'erro do provider' }),
      ])

    await refreshSendComment('notice-1', deps)

    expect(messageOf(publisher.publish.mock.calls[0])).toContain(
      'erro do provider',
    )
  })

  it('tenta gravar o comentário de novo quando a gravação falha', async () => {
    const { deps, notices } = setup({})
    notices.saveComment
      .mockRejectedValueOnce(new Error('db fora'))
      .mockResolvedValueOnce(undefined)

    await refreshSendComment('notice-1', deps)

    expect(notices.saveComment).toHaveBeenCalledTimes(2)
  })

  it('lança depois de esgotar as tentativas de gravar o comentário', async () => {
    const { deps, notices, publisher } = setup({})
    notices.saveComment.mockRejectedValue(new Error('db fora'))

    await expect(refreshSendComment('notice-1', deps)).rejects.toThrow(
      'db fora',
    )
    expect(notices.saveComment).toHaveBeenCalledTimes(3)
    expect(publisher.publish).toHaveBeenCalledTimes(1)
  })

  it('não lista em arquivo nenhum a mídia na fila ou sem confirmação', async () => {
    const { deps, publisher } = setup({
      notice: notice({ eager: true }),
      rows: [
        row({ kind: 'MEDIA', status: 'PENDING', fileName: 'fila.pdf' }),
        row({
          id: 'row-2',
          kind: 'MEDIA',
          status: 'UNKNOWN',
          fileName: 'incerto.pdf',
        }),
      ],
    })

    await refreshSendComment('notice-1', deps)

    const message = messageOf(publisher.publish.mock.calls[0])
    expect(message).not.toContain('fila.pdf')
    expect(message).not.toContain('incerto.pdf')
  })

  it('dá o motivo "não foi possível obter" ao arquivo expirado', async () => {
    const { deps, publisher } = setup({
      rows: [
        row({
          kind: 'MEDIA',
          status: 'FAILED',
          lastError: MEDIA_EXPIRED_FAILURE,
          fileName: 'velho.pdf',
        }),
      ],
    })

    await refreshSendComment('notice-1', deps)

    expect(messageOf(publisher.publish.mock.calls[0])).toContain(
      'velho.pdf (não foi possível obter o arquivo)',
    )
  })

  it('não lista como falha o arquivo recusado depois de lido', async () => {
    const { deps, publisher } = setup({
      rows: [
        row({
          kind: 'MEDIA',
          fileName: 'lido.pdf',
          rejectedAt: new Date('2026-11-27T10:02:00Z'),
          readAt: new Date('2026-11-27T10:01:00Z'),
        }),
      ],
    })

    await refreshSendComment('notice-1', deps)

    const message = messageOf(publisher.publish.mock.calls[0])
    expect(message).toContain('lido.pdf')
    expect(message).not.toContain('lido.pdf (falha no envio)')
  })
})
