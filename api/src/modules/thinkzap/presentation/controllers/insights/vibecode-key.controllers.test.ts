import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { GetInsightsStatus } from '@/modules/thinkzap/application/insights/get-insights-status'
import type { RemoveVibecodeKey } from '@/modules/thinkzap/application/insights/remove-vibecode-key'
import type { SaveVibecodeKey } from '@/modules/thinkzap/application/insights/save-vibecode-key'
import { VibecodeKeyRejectedError } from '@/modules/thinkzap/domain/errors/vibecode-key-rejected.error'
import {
  VibecodeAuthError,
  VibecodeRequestError,
} from '@/modules/thinkzap/infra/clients/vibecode.client'
import {
  GetInsightsStatusController,
  RemoveVibecodeKeyController,
  SaveVibecodeKeyController,
} from './vibecode-key.controllers'

const res = {} as Response

const req = (extra: Record<string, unknown> = {}) =>
  ({
    thinkzapInstalledAppId: 'app-1',
    thinkzapAccess: { canManageAccess: true },
    params: {},
    body: {},
    ...extra,
  }) as unknown as Request

describe('SaveVibecodeKeyController', () => {
  it('devolve 200 com last4', async () => {
    const execute = vi.fn<SaveVibecodeKey['execute']>(() =>
      Promise.resolve({ last4: 'abcd' }),
    )
    const out = await new SaveVibecodeKeyController({ execute }).perform(
      req({ body: { key: '  vk_abcd ' } }),
      res,
    )
    expect(execute).toHaveBeenCalledWith('app-1', 'vk_abcd')
    expect(out).toEqual({ status: 200, result: { last4: 'abcd' } })
  })

  it('devolve 422 com a mensagem quando a chave é recusada', async () => {
    const error = new VibecodeKeyRejectedError([{ code: 'NOT_READONLY' }])
    const execute = vi.fn<SaveVibecodeKey['execute']>(() =>
      Promise.reject(error),
    )
    const out = await new SaveVibecodeKeyController({ execute }).perform(
      req({ body: { key: 'vk_x' } }),
      res,
    )
    expect(out).toEqual({ status: 422, result: { error: error.message } })
  })

  it('devolve 502 em pt-BR quando a Vibecode falha (5xx/rede), sem a chave', async () => {
    const execute = vi.fn<SaveVibecodeKey['execute']>(() =>
      Promise.reject(new VibecodeRequestError('Falha (503) com vk_segredo')),
    )
    const out = await new SaveVibecodeKeyController({ execute }).perform(
      req({ body: { key: 'vk_segredo' } }),
      res,
    )
    expect(out.status).toBe(502)
    expect(out.result).toEqual({
      error:
        'Não foi possível falar com a Vibecode agora. Tente de novo em instantes.',
    })
    expect(JSON.stringify(out)).not.toContain('vk_segredo')
  })

  it('devolve 422 quando a Vibecode recusa a chave no /me', async () => {
    const execute = vi.fn<SaveVibecodeKey['execute']>(() =>
      Promise.reject(new VibecodeAuthError()),
    )
    const out = await new SaveVibecodeKeyController({ execute }).perform(
      req({ body: { key: 'vk_x' } }),
      res,
    )
    expect(out.status).toBe(422)
    expect(out.result).toEqual({
      error:
        'A Vibecode recusou esta chave. Confira se ela está correta e ativa.',
    })
  })

  it('devolve 400 sem corpo', async () => {
    const execute = vi.fn<SaveVibecodeKey['execute']>()
    const out = await new SaveVibecodeKeyController({ execute }).perform(
      req({ body: undefined }),
      res,
    )
    expect(out).toEqual({
      status: 400,
      result: { error: 'Informe a chave Vibecode.' },
    })
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('GetInsightsStatusController', () => {
  const status = {
    mode: 'full' as const,
    keyConfigured: true,
    last4: null,
    validatedAt: null,
    keyProblem: null,
  }

  it('sem detalhes de chave para não-admin', async () => {
    const execute = vi.fn<GetInsightsStatus['execute']>(() =>
      Promise.resolve(status),
    )
    const out = await new GetInsightsStatusController({ execute }).perform(
      req({ thinkzapAccess: { canManageAccess: false } }),
      res,
    )
    expect(execute).toHaveBeenCalledWith('app-1', { includeKeyDetails: false })
    expect(out).toEqual({ status: 200, result: status })
  })

  it('com detalhes de chave para admin', async () => {
    const execute = vi.fn<GetInsightsStatus['execute']>(() =>
      Promise.resolve(status),
    )
    await new GetInsightsStatusController({ execute }).perform(req(), res)
    expect(execute).toHaveBeenCalledWith('app-1', { includeKeyDetails: true })
  })
})

describe('RemoveVibecodeKeyController', () => {
  it('devolve 204', async () => {
    const execute = vi.fn<RemoveVibecodeKey['execute']>(() => Promise.resolve())
    const out = await new RemoveVibecodeKeyController({ execute }).perform(
      req(),
      res,
    )
    expect(execute).toHaveBeenCalledWith('app-1')
    expect(out.status).toBe(204)
  })
})
