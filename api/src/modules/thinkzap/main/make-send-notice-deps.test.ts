import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'

const m = vi.hoisted(() => ({
  getInstance: vi.fn(),
  getInstanceByInstanceId: vi.fn(),
}))

vi.mock('@/config/env', () => ({
  env: { zApi: { partnerToken: 'p', clientToken: 'c' } },
}))
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository',
  () => ({
    PrismaInstanceRepository: class {
      getInstance = m.getInstance
      getInstanceByInstanceId = m.getInstanceByInstanceId
    },
  }),
)
vi.mock('@/modules/thinkzap/infra/clients/z-api.client', () => ({
  ZApiClient: class {},
}))
vi.mock('@/modules/thinkzap/application/open-send-notice', () => ({
  openSendNotice: vi.fn(),
}))
vi.mock('@/modules/thinkzap/application/publish-send-state', () => ({
  publishSendState: vi.fn(),
}))
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-send-notice.repository',
  () => ({ PrismaSendNoticeRepository: class {} }),
)
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository',
  () => ({ PrismaWidgetOutboxRepository: class {} }),
)
vi.mock('@/modules/thinkzap/main/make-installation-locale', () => ({
  makeInstallationLocaleRepository: vi.fn(),
}))
vi.mock('@/modules/thinkzap/main/make-timeline-notifier', () => ({
  makeTimelineNotifier: vi.fn(),
}))
vi.mock('@/queue/thinkzap-send-notices.queue', () => ({
  enqueueSendNotice: vi.fn(),
}))
vi.mock(
  '@/shared/infra/persistence/repositories/prisma-domain.repository',
  () => ({ PrismaDomainRepository: class {} }),
)
vi.mock('@/shared/main/make-bitrix-client', () => ({
  makeBitrixClientByDomainAndAppCoode: vi.fn(),
}))

import { makeRefreshSendCommentDeps } from './make-send-notice-deps'

const row = { instanceId: 'instance-pk-1' } as WidgetOutboxRecord

describe('número da linha no comentário de envio', () => {
  beforeEach(() => vi.clearAllMocks())

  /** `instance_id` do outbox é a chave primária de `Instance`, não o id do provider. */
  it('acha a instância pela chave primária da row', async () => {
    m.getInstance.mockResolvedValue({
      instanceId: 'C-9',
      zApiToken: null,
      channelId: null,
    })

    await makeRefreshSendCommentDeps().fromPhone(row)

    expect(m.getInstance).toHaveBeenCalledWith('instance-pk-1')
    expect(m.getInstanceByInstanceId).not.toHaveBeenCalled()
  })

  it('instância não encontrada devolve número vazio', async () => {
    m.getInstance.mockResolvedValue(null)

    await expect(makeRefreshSendCommentDeps().fromPhone(row)).resolves.toBe('')
  })
})
