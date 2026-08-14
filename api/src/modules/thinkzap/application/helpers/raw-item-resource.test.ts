import { describe, expect, it } from 'vitest'
import { resolveRawItemResource } from './raw-item-resource'

describe('resolveRawItemResource', () => {
  it('resolve Z-API por instância e token', () => {
    expect(
      resolveRawItemResource({
        provider: 'ZAPI',
        credentials: { zApiInstanceId: 'inst-1', zApiInstanceToken: 'tok-1' },
      }),
    ).toEqual({
      provider: 'ZAPI',
      instanceId: 'inst-1',
      zApiToken: 'tok-1',
    })
  })

  it('resolve HubMessage pelo canal, sem exigir WABA', () => {
    expect(
      resolveRawItemResource({
        provider: 'HUBMESSAGE',
        credentials: { hubmessageChannelId: 'chan-1' },
      }),
    ).toEqual({
      provider: 'HUBMESSAGE',
      instanceId: 'chan-1',
      channelId: 'chan-1',
    })
  })

  it('devolve null para provider vazio, desconhecido ou NONE', () => {
    for (const provider of ['', 'NONE', 'OUTRO']) {
      expect(
        resolveRawItemResource({
          provider,
          credentials: { zApiInstanceId: 'inst-1', zApiInstanceToken: 'tok-1' },
        }),
      ).toBeNull()
    }
  })

  it('devolve null para Z-API sem token — a linha nunca conectaria', () => {
    expect(
      resolveRawItemResource({
        provider: 'ZAPI',
        credentials: { zApiInstanceId: 'inst-1' },
      }),
    ).toBeNull()
  })

  it('devolve null para item recém-criado à mão, sem credencial nenhuma', () => {
    expect(
      resolveRawItemResource({ provider: 'ZAPI', credentials: {} }),
    ).toBeNull()
    expect(
      resolveRawItemResource({ provider: 'HUBMESSAGE', credentials: {} }),
    ).toBeNull()
  })

  /**
   * O leitor cru entrega credencial cruzada sem julgar, de propósito. Aqui o provider
   * declarado é quem manda: aceitar a credencial do outro chamaria o adapter errado — e
   * desassinar no provider errado atinge o recurso de outro cliente.
   */
  it('devolve null para credencial cruzada', () => {
    expect(
      resolveRawItemResource({
        provider: 'HUBMESSAGE',
        credentials: { zApiInstanceId: 'inst-1', zApiInstanceToken: 'tok-1' },
      }),
    ).toBeNull()
    expect(
      resolveRawItemResource({
        provider: 'ZAPI',
        credentials: { hubmessageChannelId: 'chan-1' },
      }),
    ).toBeNull()
  })
})
