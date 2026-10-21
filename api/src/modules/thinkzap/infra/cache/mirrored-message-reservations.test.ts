import { describe, expect, it, vi } from 'vitest'
import { findMirroredDeviceMessage } from './mirrored-message-reservations'

const params = { domain: 'acme', bitrixChatId: '777', bitrixMessageId: '9' }
const noSleep = () => Promise.resolve()

describe('findMirroredDeviceMessage', () => {
  it('devolve o id da Z-API quando a reserva já está gravada', async () => {
    const reservations = {
      consume: vi.fn().mockResolvedValue('ME-1'),
      isPending: vi.fn(),
    }

    expect(await findMirroredDeviceMessage(reservations, params)).toBe('ME-1')
    expect(reservations.isPending).not.toHaveBeenCalled()
  })

  it('sem reserva e sem postagem pendente é resposta de operador', async () => {
    const reservations = {
      consume: vi.fn().mockResolvedValue(null),
      isPending: vi.fn().mockResolvedValue(false),
    }

    expect(await findMirroredDeviceMessage(reservations, params)).toBeNull()
  })

  it('espera a reserva de uma postagem pendente', async () => {
    const reservations = {
      consume: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('ME-1'),
      isPending: vi.fn().mockResolvedValue(true),
    }

    expect(
      await findMirroredDeviceMessage(reservations, params, {
        sleep: noSleep,
      }),
    ).toBe('ME-1')
  })

  it('pendente que não vira reserva no prazo segue como resposta de operador', async () => {
    const reservations = {
      consume: vi.fn().mockResolvedValue(null),
      isPending: vi.fn().mockResolvedValue(true),
    }

    expect(
      await findMirroredDeviceMessage(reservations, params, {
        waitMs: 1000,
        intervalMs: 250,
        sleep: noSleep,
      }),
    ).toBeNull()
    // 1 leitura inicial + 4 esperas.
    expect(reservations.consume).toHaveBeenCalledTimes(5)
  })

  it('postagem que termina durante a espera ganha uma última leitura', async () => {
    const reservations = {
      consume: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('ME-1'),
      isPending: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    }

    expect(
      await findMirroredDeviceMessage(reservations, params, {
        sleep: noSleep,
      }),
    ).toBe('ME-1')
  })
})
