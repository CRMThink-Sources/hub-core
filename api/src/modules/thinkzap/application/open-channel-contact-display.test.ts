import { describe, expect, it } from 'vitest'

import {
  UNKNOWN_CONTACT_LABEL,
  buildOpenChannelChatName,
  buildOpenChannelUser,
  resolveContactDisplayName,
} from './open-channel-contact-display'

describe('resolveContactDisplayName', () => {
  it('usa o primeiro candidato preenchido', () => {
    expect(resolveContactDisplayName(['João', 'Chat', '5547992259475'])).toBe(
      'João',
    )
  })

  it('pula candidato vazio ou só com espaços', () => {
    expect(resolveContactDisplayName(['', '   ', 'Chat'])).toBe('Chat')
  })

  it('pula null e undefined', () => {
    expect(resolveContactDisplayName([null, undefined, 'Chat'])).toBe('Chat')
  })

  /**
   * A garantia central: o identificador interno do WhatsApp não chega à tela do
   * operador, nem quando a Z-API o manda como push name de contato sem nome.
   */
  it('descarta candidato que contém @lid', () => {
    expect(
      resolveContactDisplayName(['3577724534928@lid', '5547992259475']),
    ).toBe('5547992259475')
  })

  it('sem nenhum candidato válido, devolve o rótulo neutro', () => {
    expect(resolveContactDisplayName([null, '', '123@lid'])).toBe(
      UNKNOWN_CONTACT_LABEL,
    )
  })

  it('o rótulo neutro não contém lid', () => {
    expect(UNKNOWN_CONTACT_LABEL).not.toContain('@lid')
  })
})

describe('buildOpenChannelChatName', () => {
  it('anexa o telefone quando conhecido', () => {
    expect(buildOpenChannelChatName('João', '5547992259475')).toBe(
      'João - 5547992259475',
    )
  })

  /** Contato lid-only não tem número; o sufixo some em vez de virar dígitos do lid. */
  it('sem telefone, fica só o nome', () => {
    expect(buildOpenChannelChatName('João', null)).toBe('João')
  })
})

describe('buildOpenChannelUser', () => {
  it('inclui o telefone quando conhecido', () => {
    const user = buildOpenChannelUser({
      id: '357@lid',
      name: 'João',
      phone: '5547992259475',
    })

    expect(user.phone).toBe('5547992259475')
  })

  /**
   * Omitir, não mandar vazio: o Bitrix grava a chave presente como telefone do contato,
   * e um telefone vazio some do lugar onde alguém procuraria por que não liga.
   */
  it('omite a chave phone quando não há telefone', () => {
    const user = buildOpenChannelUser({
      id: '357@lid',
      name: 'João',
      phone: null,
    })

    expect(user).not.toHaveProperty('phone')
  })

  it('nunca deixa o lid virar telefone', () => {
    const user = buildOpenChannelUser({
      id: '3577724534928@lid',
      name: 'João',
      phone: null,
    })

    expect(JSON.stringify(user)).not.toContain('"phone"')
  })

  it('inclui a foto só quando há url', () => {
    expect(
      buildOpenChannelUser({ id: 'x', name: 'y', phone: null }),
    ).not.toHaveProperty('picture')
    expect(
      buildOpenChannelUser({
        id: 'x',
        name: 'y',
        phone: null,
        pictureUrl: 'http://f/p.png',
      }).picture,
    ).toEqual({ url: 'http://f/p.png' })
  })
})
