import { describe, expect, it, vi } from 'vitest'
import { GetSendDetail } from '@/modules/thinkzap/application/get-send-detail'
import { outboxRow } from '@/modules/thinkzap/application/helpers/outbox-row.fixture'
import { SendNotFoundError } from '@/modules/thinkzap/domain/errors/send-not-found.error'
import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import type {
  SendLineCatalog,
  SendListReader,
  SendSenderNameResolver,
} from '@/modules/thinkzap/domain/ports/send-list-lookups.port'
import type { SendListItem } from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-list.repository'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'

const now = new Date('2026-11-27T12:00:00.000Z')
const at = (hours: number) => new Date(now.getTime() - hours * 3_600_000)

const identity = {
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  bitrixUserId: '7',
}

const itemOf = (parts: WidgetOutboxRecord[]): SendListItem => ({
  headId: parts[0]?.id ?? 'row-1',
  destination: parts[0]?.destination ?? '5511999999999',
  createdAt: at(3),
  parts,
})

function build(
  options: {
    found?: SendListItem | null
    names?: Map<string, string> | Error
    locale?: 'pt' | 'en' | 'es'
  } = {},
) {
  const sends = {
    list: vi.fn<SendListReader['list']>(),
    listLineIds: vi.fn<SendListReader['listLineIds']>(),
    listSenderIds: vi.fn<SendListReader['listSenderIds']>(),
    findDetail: vi
      .fn<SendListReader['findDetail']>()
      .mockResolvedValue(options.found ?? null),
  }
  const locales = {
    byAppId: vi.fn<InstallationLocaleRepository['byAppId']>(),
    byInstallation: vi
      .fn<InstallationLocaleRepository['byInstallation']>()
      .mockResolvedValue(options.locale ?? 'pt'),
    save: vi.fn<InstallationLocaleRepository['save']>(),
  }
  const lines = {
    listLines: vi
      .fn<SendLineCatalog['listLines']>()
      .mockResolvedValue([{ id: 'line-1', name: 'Vendas' }]),
  }
  const names = options.names ?? new Map([['7', 'Ana Souza']])
  const senderNames = {
    resolveNames: vi
      .fn<SendSenderNameResolver['resolveNames']>()
      .mockImplementation(() =>
        names instanceof Error ? Promise.reject(names) : Promise.resolve(names),
      ),
  }
  return {
    sut: new GetSendDetail(sends, locales, lines, senderNames),
    sends,
    senderNames,
    lines,
  }
}

describe('GetSendDetail', () => {
  describe('negações idênticas', () => {
    // O repositório devolve null para toda recusa de visibilidade; o caso de
    // uso tem de transformar todas na mesma resposta.
    it.each([
      'envio de outro remetente',
      'outra instalação',
      'id inexistente',
      'mais de 90 dias',
      'envio de SMS (não acompanhado)',
    ])('%s -> não encontrado', async () => {
      const { sut } = build({ found: null })

      await expect(
        sut.execute({ ...identity, id: 'x', isAdmin: false }),
      ).rejects.toBeInstanceOf(SendNotFoundError)
    })

    it('as mensagens de todas as negações são iguais', async () => {
      const { sut } = build({ found: null })
      const messages = await Promise.all(
        ['a', 'b'].map(id =>
          sut
            .execute({ ...identity, id, isAdmin: false })
            .then(() => '')
            .catch((error: Error) => error.message),
        ),
      )

      expect(messages[0]).not.toBe('')
      expect(messages[0]).toBe(messages[1])
    })

    it('operador consulta com o próprio id; administrador sem filtro', async () => {
      const operator = build({ found: null })
      const admin = build({ found: null })

      await operator.sut
        .execute({ ...identity, id: 'x', isAdmin: false })
        .catch(() => undefined)
      await admin.sut
        .execute({ ...identity, id: 'x', isAdmin: true })
        .catch(() => undefined)

      expect(operator.sends.findDetail).toHaveBeenCalledWith('x', {
        domainId: 'domain-1',
        appCode: 'crmthink.thinkzap',
        onlyOperatorId: '7',
      })
      expect(admin.sends.findDetail).toHaveBeenCalledWith(
        'x',
        expect.objectContaining({ onlyOperatorId: null }),
      )
    })
  })

  it('template lido: texto, template, horários e link do CRM', async () => {
    const row = outboxRow({
      kind: 'TEMPLATE',
      templateName: 'boas_vindas',
      templateLanguage: 'pt_BR',
      text: 'Olá, Maria!',
      origin: 'ROBOT_TEMPLATE',
      sentAt: at(3),
      deliveredAt: at(2),
      readAt: at(1),
      entity: 'DEAL',
      entityId: '55',
    })
    const { sut } = build({ found: itemOf([row]) })

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail).toMatchObject({
      id: 'row-1',
      status: 'READ',
      kind: 'template',
      origin: 'robot',
      text: 'Olá, Maria!',
      template: { name: 'boas_vindas', language: 'pt_BR' },
      line: { id: 'line-1', name: 'Vendas' },
      sender: { id: '7', name: 'Ana Souza' },
      failure: null,
      failureReason: null,
      crmRecord: {
        entity: 'DEAL',
        entityId: '55',
        url: '/crm/deal/details/55/',
      },
      timestamps: {
        sentAt: at(3).toISOString(),
        deliveredAt: at(2).toISOString(),
        readAt: at(1).toISOString(),
        rejectedAt: null,
      },
    })
  })

  it('o texto vem da parte, não do dispatchMeta (robô, segundo destinatário)', async () => {
    const row = outboxRow({
      origin: 'ROBOT_MESSAGE',
      text: 'Mensagem do robô',
      dispatchMeta: null,
      dispatchGroupId: 'g',
    })
    const { sut } = build({ found: itemOf([row]) })

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail.text).toBe('Mensagem do robô')
  })

  it('três partes: estado por parte e horários só quando todas os têm', async () => {
    const parts = [
      outboxRow({
        id: 'p0',
        partIndex: 0,
        dispatchGroupId: 'g',
        sentAt: at(5),
        deliveredAt: at(4),
        readAt: at(3),
      }),
      outboxRow({
        id: 'p1',
        partIndex: 1,
        dispatchGroupId: 'g',
        kind: 'MEDIA',
        fileName: 'foto.png',
        text: '',
        caption: 'Legenda',
        sentAt: at(4),
        deliveredAt: at(2),
      }),
      outboxRow({
        id: 'p2',
        partIndex: 2,
        dispatchGroupId: 'g',
        kind: 'MEDIA',
        fileName: 'doc.pdf',
        text: '',
        status: 'FAILED',
        lastError: 'arquivo fora do ar',
        sentAt: null,
      }),
    ]
    const { sut } = build({ found: itemOf(parts) })

    const detail = await sut.execute({
      ...identity,
      id: 'p1',
      isAdmin: true,
    })

    expect(detail.status).toBe('PARTIAL')
    expect(detail.kind).toBe('attachment')
    expect(detail.parts).toEqual([
      { kind: 'text', fileName: null, status: 'READ', failureReason: null },
      {
        kind: 'attachment',
        fileName: 'foto.png',
        status: 'DELIVERED',
        failureReason: null,
      },
      {
        kind: 'attachment',
        fileName: 'doc.pdf',
        status: 'FAILED',
        failureReason: 'arquivo fora do ar',
      },
    ])
    // Primeiro envio entre as partes; entrega/leitura nulas porque a parte 3 não as tem.
    expect(detail.timestamps).toEqual({
      sentAt: at(5).toISOString(),
      deliveredAt: null,
      readAt: null,
      rejectedAt: null,
    })
    expect(detail.failure).toEqual({
      code: null,
      reason: 'arquivo fora do ar',
    })
  })

  it('entregue e lido ficam com o horário da última parte a chegar', async () => {
    const parts = [
      outboxRow({
        id: 'p0',
        partIndex: 0,
        dispatchGroupId: 'g',
        deliveredAt: at(4),
        readAt: at(3),
      }),
      outboxRow({
        id: 'p1',
        partIndex: 1,
        dispatchGroupId: 'g',
        deliveredAt: at(2),
        readAt: at(1),
      }),
    ]
    const { sut } = build({ found: itemOf(parts) })

    const detail = await sut.execute({
      ...identity,
      id: 'p0',
      isAdmin: true,
    })

    expect(detail.timestamps.deliveredAt).toBe(at(2).toISOString())
    expect(detail.timestamps.readAt).toBe(at(1).toISOString())
  })

  it.each([
    ['dynamic_999 (SPA sem tipo conhecido)', 'dynamic_abc', '10'],
    ['entidade desconhecida', 'quote_x', '10'],
    ['id não numérico', 'deal', '../x'],
    ['entidade vazia', '', ''],
  ])('%s: sem link do CRM', async (_name, entity, entityId) => {
    const { sut } = build({ found: itemOf([outboxRow({ entity, entityId })]) })

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail.crmRecord).toBeNull()
  })

  it('falha com código da Meta traduzida no idioma da instalação', async () => {
    const row = outboxRow({
      rejectedAt: at(1),
      failureCode: '131047',
      failureReason: 'Re-engagement message',
    })
    const { sut } = build({ found: itemOf([row]), locale: 'en' })

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail.status).toBe('FAILED')
    expect(detail.failure?.code).toBe('131047')
    expect(detail.failure?.reason).toBe(detail.failureReason)
    expect(detail.failure?.reason).toContain('24')
    expect(detail.timestamps.rejectedAt).toBe(at(1).toISOString())
  })

  it('falha sem motivo traz a frase genérica, nunca vazio', async () => {
    const row = outboxRow({ status: 'FAILED', lastError: null })
    const { sut } = build({ found: itemOf([row]), locale: 'es' })

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail.failure?.code).toBeNull()
    expect(detail.failure?.reason).toContain('motivo no informado')
  })

  it('catálogo de linhas falhando não derruba o detalhe', async () => {
    const found = itemOf([outboxRow()])
    const { sut, lines } = build({ found })
    lines.listLines.mockRejectedValue(new Error('Bitrix fora'))

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail.line).toEqual({ id: 'line-1', name: 'line-1' })
  })

  it('UNKNOWN com erro cru mostra a frase de conferir, e hasUnconfirmed', async () => {
    const row = outboxRow({
      status: 'UNKNOWN',
      lastError: 'timeout of 30000ms exceeded',
    })
    const { sut } = build({ found: itemOf([row]), locale: 'en' })

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail.hasUnconfirmed).toBe(true)
    expect(detail.failure?.reason).toContain('BEFORE resending')
    expect(detail.failure?.reason).not.toContain('timeout')
    expect(detail.parts[0]?.failureReason).not.toContain('timeout')
  })

  it('recusa seguida de entrega não mostra horário de recusa', async () => {
    const row = outboxRow({
      rejectedAt: at(2),
      deliveredAt: at(1),
      failureCode: '131047',
    })
    const { sut } = build({ found: itemOf([row]) })

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail.status).toBe('DELIVERED')
    expect(detail.timestamps.rejectedAt).toBeNull()
  })

  it('Bitrix fora do ar: detalhe abre com remetente sem nome', async () => {
    const { sut } = build({
      found: itemOf([outboxRow()]),
      names: new Error('503'),
    })

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail.sender).toEqual({ id: '7', name: null })
  })

  it('robô sem usuário: não chama o Bitrix', async () => {
    const { sut, senderNames } = build({
      found: itemOf([outboxRow({ operatorBitrixUserId: null })]),
    })

    const detail = await sut.execute({
      ...identity,
      id: 'row-1',
      isAdmin: true,
    })

    expect(detail.sender).toEqual({ id: null, name: null })
    expect(senderNames.resolveNames).not.toHaveBeenCalled()
  })
})
