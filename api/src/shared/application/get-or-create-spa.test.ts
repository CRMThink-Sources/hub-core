import { describe, expect, it, vi } from 'vitest'
import { BITRIX_SPA_CLIENT_FIELDS as F } from '@/shared/domain/config/bitrix.env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixSpaRepository } from '@/shared/infra/persistence/repositories/bitrix-spa.repository'
import { GetOrCreateSpa } from './get-or-create-spa'

/**
 * Integração de propósito — `GetOrCreateSpa` com o repositório **real** sobre um
 * client de Bitrix falso.
 *
 * A regressão que este arquivo existe para travar mora exatamente na costura entre
 * os dois: o caso de uso mandava `''` por "não tenho o dado", o repositório
 * escrevia todo campo definido, e uma reinstalação apagava o contato comercial.
 * Testar cada lado isolado com dublê deixaria a costura sem cobertura.
 */

const KEY = { appId: 'crmthink.thinkzap', domain: 'acme.bitrix24.com.br' }

const withContact = {
  id: 4242,
  [F.MEMBER_ID]: 'member-1',
  [F.NAME]: 'Joana Silva',
  [F.EMAIL]: 'joana@acme.com',
  [F.PHONE]: '5511999998888',
  [F.COMPANY]: 'Acme LTDA',
}

function makeSut(item: Record<string, unknown> | null) {
  const updateCrmItem = vi.fn(() => Promise.resolve({ result: { id: '4242' } }))
  const createCrmItem = vi.fn(() =>
    Promise.resolve({ result: { item: { id: '4242' } } }),
  )

  const bitrix = {
    listCrmItems: vi.fn(() =>
      Promise.resolve({ result: { items: item ? [item] : [] } }),
    ),
    updateCrmItem,
    createCrmItem,
  } as unknown as BitrixClient

  return {
    sut: new GetOrCreateSpa(new BitrixSpaRepository(bitrix)),
    updateCrmItem,
    createCrmItem,
  }
}

function patchOf(updateCrmItem: {
  mock: { calls: unknown[][] }
}): Record<string, unknown> {
  const [call] = updateCrmItem.mock.calls
  if (!call) throw new Error('updateCrmItem não foi chamado')

  return call[2] as Record<string, unknown>
}

describe('GetOrCreateSpa', () => {
  it('preserva nome, telefone e empresa numa reinstalação', async () => {
    const { sut, updateCrmItem } = makeSut(withContact)

    // Exatamente o que `InstallApp` manda: sem contato, porque o payload de
    // instalação não o tem.
    const spa = await sut.execute({
      ...KEY,
      memberId: 'member-1',
      email: 'admin@acme.com',
    })

    const patch = patchOf(updateCrmItem)

    expect(patch).not.toHaveProperty(F.NAME)
    expect(patch).not.toHaveProperty(F.PHONE)
    expect(patch).not.toHaveProperty(F.COMPANY)

    expect(spa).toMatchObject({
      name: 'Joana Silva',
      phone: '5511999998888',
      company: 'Acme LTDA',
    })
  })

  it('atualiza o e-mail na reinstalação', async () => {
    const { sut, updateCrmItem } = makeSut(withContact)

    await sut.execute({
      ...KEY,
      memberId: 'member-1',
      email: 'admin@acme.com',
    })

    expect(patchOf(updateCrmItem)).toMatchObject({
      [F.EMAIL]: 'admin@acme.com',
    })
  })

  it('repassa o contato quando ele é informado', async () => {
    const { sut, updateCrmItem } = makeSut(withContact)

    await sut.execute({
      ...KEY,
      memberId: 'member-1',
      email: 'comercial@acme.com',
      name: 'Joana Souza',
      phone: '5511777776666',
      company: 'Acme S.A.',
    })

    expect(patchOf(updateCrmItem)).toMatchObject({
      [F.NAME]: 'Joana Souza',
      [F.EMAIL]: 'comercial@acme.com',
      [F.PHONE]: '5511777776666',
      [F.COMPANY]: 'Acme S.A.',
    })
  })

  it('cria o item com contato vazio quando ele não existe', async () => {
    const { sut, createCrmItem, updateCrmItem } = makeSut(null)

    await sut.execute({
      ...KEY,
      memberId: 'member-1',
      email: 'admin@acme.com',
    })

    const [, fields] = createCrmItem.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ]

    expect(fields[F.NAME]).toBe('')
    expect(fields[F.PHONE]).toBe('')
    expect(fields[F.COMPANY]).toBe('')
    expect(fields[F.EMAIL]).toBe('admin@acme.com')
    expect(updateCrmItem).not.toHaveBeenCalled()
  })
})
