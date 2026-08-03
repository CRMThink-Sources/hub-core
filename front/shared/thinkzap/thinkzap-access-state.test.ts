import { describe, expect, it, vi } from 'vitest'
import {
  loadThinkzapAccess,
  toThinkzapAccessState,
} from './thinkzap-access-state'
import { FULL_THINKZAP_PERMISSIONS } from '@/shared/thinkzap-permissions'

const denied = {
  canManageAccess: false,
  canAccess: false,
  canAccessFinance: false,
  permissions: {
    connectors: { read: false, create: false, update: false, delete: false },
    finance: { read: false, create: false, update: false, delete: false },
  },
}

const financeOnly = {
  canManageAccess: false,
  canAccess: false,
  canAccessFinance: true,
  permissions: {
    connectors: { read: false, create: false, update: false, delete: false },
    finance: { read: true, create: false, update: false, delete: false },
  },
}

describe('toThinkzapAccessState', () => {
  it('mapeia 200 com permissões completas para ready', () => {
    const state = toThinkzapAccessState({
      kind: 'ok',
      data: {
        canManageAccess: true,
        canAccess: true,
        canAccessFinance: true,
        permissions: FULL_THINKZAP_PERMISSIONS,
      },
    })

    expect(state).toEqual({
      status: 'ready',
      access: {
        canManageAccess: true,
        canAccess: true,
        canAccessFinance: true,
        permissions: FULL_THINKZAP_PERMISSIONS,
      },
    })
  })

  it('mapeia o payload negado para ready — negado é dado, não erro', () => {
    const state = toThinkzapAccessState({ kind: 'ok', data: denied })

    expect(state).toEqual({ status: 'ready', access: denied })
  })

  it('preserva acesso só de finanças (permissão herdada de departamento)', () => {
    const state = toThinkzapAccessState({ kind: 'ok', data: financeOnly })

    expect(state).toMatchObject({
      status: 'ready',
      access: { canAccess: false, canAccessFinance: true },
    })
  })

  it('normaliza ações ausentes para false em vez de deixar undefined', () => {
    const state = toThinkzapAccessState({
      kind: 'ok',
      data: {
        canAccess: true,
        permissions: {
          connectors: { read: true },
          finance: {},
        },
      },
    })

    expect(state).toEqual({
      status: 'ready',
      access: {
        canManageAccess: false,
        canAccess: true,
        canAccessFinance: false,
        permissions: {
          connectors: {
            read: true,
            create: false,
            update: false,
            delete: false,
          },
          finance: { read: false, create: false, update: false, delete: false },
        },
      },
    })
  })

  it('mapeia 401 para unauthenticated', () => {
    expect(toThinkzapAccessState({ kind: 'status', status: 401 })).toEqual({
      status: 'unauthenticated',
    })
  })

  it.each([403, 404, 500, 502])('mapeia %s para error', (status: number) => {
    expect(toThinkzapAccessState({ kind: 'status', status }).status).toBe(
      'error',
    )
  })

  it('mapeia falha de rede para error', () => {
    expect(
      toThinkzapAccessState({ kind: 'network', message: 'offline' }),
    ).toEqual({ status: 'error', message: 'offline' })
  })

  it('trata payload sem permissions como error, e não como negado', () => {
    expect(
      toThinkzapAccessState({ kind: 'ok', data: { canAccess: true } }).status,
    ).toBe('error')
    expect(toThinkzapAccessState({ kind: 'ok', data: null }).status).toBe(
      'error',
    )
  })
})

describe('loadThinkzapAccess', () => {
  it('não dispara requisição sem token', async () => {
    const request = vi.fn()

    const state = await loadThinkzapAccess({ readToken: () => null, request })

    expect(state).toEqual({ status: 'unauthenticated' })
    expect(request).not.toHaveBeenCalled()
  })

  it('passa o token para a requisição', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ kind: 'ok' as const, data: denied })

    await loadThinkzapAccess({ readToken: () => 'jwt-1', request })

    expect(request).toHaveBeenCalledWith('jwt-1')
  })
})
