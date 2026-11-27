import { describe, expect, it, vi } from 'vitest'

const makeBitrixClient = vi.hoisted(() => vi.fn())
vi.mock('../../../shared/main/make-bitrix-client', () => ({ makeBitrixClient }))
vi.mock('@/modules/application/main/make-get-aplication-context', () => ({
  makeGetAplicationContext: vi.fn(() => ({})),
}))
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-send-list.repository',
  () => ({ PrismaSendListRepository: class {} }),
)
vi.mock('@/modules/thinkzap/main/make-installation-locale', () => ({
  makeInstallationLocaleRepository: vi.fn(() => ({})),
}))

import type { Request } from 'express'
import { makeSendLookups } from './make-send-lookups'

describe('makeSendLookups', () => {
  it('montar as dependências não cria o cliente Bitrix', () => {
    makeSendLookups({} as Request)
    expect(makeBitrixClient).not.toHaveBeenCalled()
  })

  it('credencial ausente deixa os nomes em branco em vez de lançar', async () => {
    makeBitrixClient.mockRejectedValue(new Error('App not found'))
    const { senderNames } = makeSendLookups({} as Request)
    const names = await senderNames.resolveNames(['7'])
    expect(names.size).toBe(0)
    expect(makeBitrixClient).toHaveBeenCalledTimes(1)
  })
})
