import { describe, expect, it } from 'vitest'
import {
  type ContactCenterLine,
  resolvePlacementLine,
  toChannelOptions,
  toLineOptions,
} from './contact-center-placement'

describe('resolvePlacementLine', () => {
  it('lê LINE de options em objeto', () => {
    expect(resolvePlacementLine({ options: { LINE: '7' } })).toBe(7)
  })

  it('lê LINE de options serializada', () => {
    expect(resolvePlacementLine({ options: '{"LINE":"12"}' })).toBe(12)
  })

  it('usa LINE_ID quando não há LINE', () => {
    expect(resolvePlacementLine({ options: { LINE_ID: '105' } })).toBe(105)
  })

  it('é null sem canal', () => {
    expect(resolvePlacementLine({ options: {} })).toBeNull()
    expect(resolvePlacementLine({ options: { LINE: '' } })).toBeNull()
    expect(resolvePlacementLine(null)).toBeNull()
    expect(resolvePlacementLine({})).toBeNull()
  })

  it('é null com canal não numérico ou options inválida', () => {
    expect(resolvePlacementLine({ options: { LINE: 'abc' } })).toBeNull()
    expect(resolvePlacementLine({ options: { LINE: '1.5' } })).toBeNull()
    expect(resolvePlacementLine({ options: '{quebrado' })).toBeNull()
  })
})

const line = (
  overrides: Partial<ContactCenterLine> = {},
): ContactCenterLine => ({
  id: 'item-1',
  phoneData: { phone: '5511999990000', name: 'Comercial' },
  instance: { name: 'Linha comercial', vinculatedChannel: null },
  ...overrides,
})

describe('toLineOptions', () => {
  it('rotula pelo telefone e nome do WhatsApp', () => {
    const { options } = toLineOptions([line()], 7)
    expect(options[0].label).toBe('5511999990000 — Comercial')
  })

  it('rotula pelo nome da linha sem phoneData', () => {
    const { options } = toLineOptions([line({ phoneData: null })], 7)
    expect(options[0].label).toBe('Linha comercial')
  })

  it('marca e pré-seleciona a linha vinculada a este canal', () => {
    const { options, preselectedId } = toLineOptions(
      [
        line({ id: 'a', instance: { name: 'A', vinculatedChannel: '3' } }),
        line({ id: 'b', instance: { name: 'B', vinculatedChannel: '7' } }),
      ],
      7,
    )
    expect(options.map(option => option.linkedHere)).toEqual([false, true])
    expect(preselectedId).toBe('b')
  })

  it('não pré-seleciona quando nenhuma é deste canal', () => {
    const { options, preselectedId } = toLineOptions(
      [line({ instance: { name: 'A', vinculatedChannel: '3' } })],
      7,
    )
    expect(options[0].linkedHere).toBe(false)
    expect(preselectedId).toBe('')
  })

  it('não marca nada sem canal identificado', () => {
    const { options } = toLineOptions(
      [line({ instance: { name: 'A', vinculatedChannel: '7' } })],
      null,
    )
    expect(options[0].linkedHere).toBe(false)
  })

  it('aceita lista vazia', () => {
    expect(toLineOptions([], 7)).toEqual({ options: [], preselectedId: '' })
  })
})

describe('toChannelOptions', () => {
  const channels = [
    { id: '3', active: true, name: 'Vendas' },
    { id: '7', active: true, name: 'Suporte' },
    { id: 9, active: false, name: 'Antigo' },
  ]

  it('"Conectar" sem vínculo no canal do placement não pré-seleciona', () => {
    const { preselectedChannelId } = toChannelOptions(channels, [line()], 7)
    expect(preselectedChannelId).toBe('')
  })

  it('"Alterar" pré-seleciona o canal do placement já vinculado', () => {
    const { preselectedChannelId } = toChannelOptions(
      channels,
      [line({ instance: { name: 'A', vinculatedChannel: '7' } })],
      7,
    )
    expect(preselectedChannelId).toBe('7')
  })

  it('não pré-seleciona sem canal do placement', () => {
    const { preselectedChannelId } = toChannelOptions(
      channels,
      [line({ instance: { name: 'A', vinculatedChannel: '7' } })],
      null,
    )
    expect(preselectedChannelId).toBe('')
  })

  it('identifica o canal ocupado pela linha', () => {
    const { options } = toChannelOptions(
      channels,
      [line({ instance: { name: 'A', vinculatedChannel: '3' } })],
      null,
    )
    expect(options[0].occupiedBy).toBe('5511999990000 — Comercial')
    expect(options[1].occupiedBy).toBeNull()
  })

  it('marca canal inativo e normaliza id numérico', () => {
    const { options } = toChannelOptions(channels, [], null)
    expect(options[2]).toEqual({
      id: '9',
      label: 'Antigo (inativo)',
      occupiedBy: null,
    })
  })

  it('usa o id quando o canal não tem nome', () => {
    const { options } = toChannelOptions([{ id: '4', active: true }], [], null)
    expect(options[0].label).toBe('Canal 4')
  })

  it('aceita lista vazia', () => {
    expect(toChannelOptions([], [line()], 7)).toEqual({
      options: [],
      preselectedChannelId: '',
    })
  })
})
