import { describe, expect, it } from 'vitest'
import { toOpenChannelList } from './to-open-channel-list'

const canal = (id: string) => ({
  ID: id,
  LINE_NAME: `Canal ${id}`,
  ACTIVE: 'Y',
})

// `IGetOpenChannelsResponse` declara `result` como array, mas o portal responde objeto
// indexado por id em parte dos casos: o `.map` direto do controller virava 500.
describe('toOpenChannelList', () => {
  it('passa array adiante', () => {
    expect(toOpenChannelList([canal('7'), canal('9')]).map(c => c.ID)).toEqual([
      '7',
      '9',
    ])
  })

  it('achata objeto indexado por id', () => {
    const resposta = { '7': canal('7'), '132': canal('132') }

    expect(toOpenChannelList(resposta).map(c => c.ID)).toEqual(['7', '132'])
  })

  it('descarta entrada que não é objeto', () => {
    // Portal já devolveu `false` na posição de um canal removido.
    const resposta = { '7': canal('7'), '8': null, '9': false }

    expect(toOpenChannelList(resposta).map(c => c.ID)).toEqual(['7'])
  })

  it('vira lista vazia para resposta sem canais', () => {
    // `result` ausente é o caso de portal sem canal aberto nenhum.
    expect(toOpenChannelList(undefined)).toEqual([])
    expect(toOpenChannelList(null)).toEqual([])
    expect(toOpenChannelList('')).toEqual([])
  })
})
