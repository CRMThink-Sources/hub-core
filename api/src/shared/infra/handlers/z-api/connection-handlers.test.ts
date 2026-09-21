import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZApiConnectedHandler } from './connected.handler'
import { ZApiDisconectedHandler } from './disconected.handler'
import type { ZApiConnectedEvent, ZApiDisconectedEvent } from './z-api'
import { getIo } from '@/shared/infra/socket'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/shared/infra/socket', () => ({ getIo: vi.fn() }))

/**
 * O aviso de desconexão (best-effort, ver `disconected.handler.ts`) resolve
 * instância/domínio/app antes de tocar o Bitrix. Sem instância encontrada, o
 * handler encerra cedo — suficiente para estes testes, que só cobrem o socket.
 * Os demais módulos precisam de mock aqui mesmo sem serem exercitados: são
 * import estático de `disconected.handler.ts`, e puxariam o Prisma real.
 */
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository',
  () => ({
    PrismaInstanceRepository: class {
      getInstanceByInstanceId = vi.fn().mockResolvedValue(null)
    },
  }),
)

vi.mock('@/shared/infra/persistence/repositories/prisma-domain.repository', () => ({
  PrismaDomainRepository: class {
    getDomainById = vi.fn()
  },
}))

vi.mock(
  '@/shared/infra/persistence/repositories/prisma-installed-app.repository',
  () => ({
    PrismaInstalledAppRepository: class {
      getByAppCodeAndDomainId = vi.fn()
    },
  }),
)

vi.mock('@/shared/main/make-bitrix-client', () => ({
  makeBitrixClientByDomainAndAppCoode: vi.fn(),
}))

vi.mock('@/shared/app-catalog/app-catalog', () => ({
  thinkzapAppCodeId: () => 'crmthink.thinkzap',
}))

vi.mock(
  '@/modules/thinkzap/application/thinkzap-disconnect-notify-settings.service',
  () => ({
    ThinkzapDisconnectNotifySettingsService: class {
      get = vi.fn()
    },
  }),
)

vi.mock('@/shared/application/bitrix-system-notification.service', () => ({
  BitrixSystemNotificationService: class {
    notify = vi.fn()
  },
}))

/**
 * `emit` do servidor e `emit` da sala são espiões **diferentes** de propósito: é o
 * que deixa "emitiu em broadcast" e "emitiu na sala" distinguíveis. O antigo
 * handler de desconexão fazia `getIo().emit(...)`, que passaria despercebido se
 * os dois compartilhassem o mesmo espião.
 */
const makeIo = () => {
  const roomEmit = vi.fn()
  const to = vi.fn(() => ({ emit: roomEmit }))
  const broadcastEmit = vi.fn()

  vi.mocked(getIo).mockReturnValue({
    to,
    emit: broadcastEmit,
  } as unknown as ReturnType<typeof getIo>)

  return { to, roomEmit, broadcastEmit }
}

const connectedEvent: ZApiConnectedEvent = {
  type: 'ConnectedCallback',
  connected: true,
  momment: 1_700_000_000,
  instanceId: 'Z-INSTANCE-1',
  phone: '5511999999999',
  lid: '55119999@lid',
  isBusiness: true,
}

const disconnectedEvent: ZApiDisconectedEvent = {
  type: 'DisconnectedCallback',
  disconnected: true,
  momment: 1_700_000_000,
  instanceId: 'Z-INSTANCE-1',
  phone: '5511999999999',
  lid: '55119999@lid',
  isBusiness: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ZApiConnectedHandler', () => {
  it('emite o aviso na sala da instância', async () => {
    const { to, roomEmit } = makeIo()

    await new ZApiConnectedHandler().handle(connectedEvent)

    expect(to).toHaveBeenCalledWith('Z-INSTANCE-1')
    expect(roomEmit).toHaveBeenCalledWith('instance:connected', {
      status: 'connected',
    })
  })

  /**
   * O socket não autentica handshake nem `join`, e a sala tem o nome do
   * `instanceId`. O evento cru da Z-API entregaria o telefone do cliente a quem
   * adivinhasse esse id.
   */
  it('não vaza dado pessoal do evento cru', async () => {
    const { roomEmit } = makeIo()

    await new ZApiConnectedHandler().handle(connectedEvent)

    const payload = roomEmit.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).toEqual({ status: 'connected' })
    expect(payload).not.toHaveProperty('phone')
    expect(payload).not.toHaveProperty('lid')
    expect(payload).not.toHaveProperty('isBusiness')
  })

  it('não emite em broadcast', async () => {
    const { broadcastEmit } = makeIo()

    await new ZApiConnectedHandler().handle(connectedEvent)

    expect(broadcastEmit).not.toHaveBeenCalled()
  })
})

describe('ZApiDisconectedHandler', () => {
  it('emite o aviso na sala da instância', async () => {
    const { to, roomEmit } = makeIo()

    await new ZApiDisconectedHandler().handle(disconnectedEvent)

    expect(to).toHaveBeenCalledWith('Z-INSTANCE-1')
    expect(roomEmit).toHaveBeenCalledWith('connector:disconnected', {
      status: 'disconnected',
    })
  })

  /**
   * Regressão do comportamento anterior: `getIo().emit(...)` entregava a
   * desconexão de um cliente a todos os sockets conectados.
   */
  it('não emite em broadcast global', async () => {
    const { broadcastEmit } = makeIo()

    await new ZApiDisconectedHandler().handle(disconnectedEvent)

    expect(broadcastEmit).not.toHaveBeenCalled()
  })

  it('não vaza dado pessoal do evento cru', async () => {
    const { roomEmit } = makeIo()

    await new ZApiDisconectedHandler().handle(disconnectedEvent)

    const payload = roomEmit.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).toEqual({ status: 'disconnected' })
    expect(payload).not.toHaveProperty('phone')
    expect(payload).not.toHaveProperty('lid')
  })
})
