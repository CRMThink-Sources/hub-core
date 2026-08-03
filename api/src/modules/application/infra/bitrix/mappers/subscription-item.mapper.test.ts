import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it } from 'vitest'
import {
  SUBSCRIPTION_PARENT_FIELD,
  collectBitrixSpaSubscriptionItemToSubscriptionItem,
  mapBitrixSpaSubscriptionItemToSubscriptionItem,
  mapSubscriptionItemInputToBitrixFields,
} from './subscription-item.mapper'
import { InvalidBitrixSubscriptionItemError } from '../errors/invalid-bitrix-subscription-item.error'

/** Item mínimo válido: sem credencial, sem gateway. */
const validItem = (overrides: Record<string, unknown> = {}) => ({
  id: 555,
  title: 'Conector 1',
  [SUBSCRIPTION_PARENT_FIELD]: 4242,
  ufCrm93Status: '13625',
  ...overrides,
})

const zApiPair = {
  ufCrm93ZApiInstanceId: 'inst-1',
  ufCrm93ZApiInstanceToken: 'tok-1',
}

const hubPair = {
  ufCrm93HubChanelId: 'chan-1',
  ufCrm93HubWabaId: 'waba-1',
}

const issuePaths = (error: unknown): string[] => {
  expect(error).toBeInstanceOf(InvalidBitrixSubscriptionItemError)
  const { issues } = error as InvalidBitrixSubscriptionItemError
  return issues.flatMap(issue => issue.path.map(String))
}

const expectInvalid = (raw: unknown): string[] => {
  try {
    mapBitrixSpaSubscriptionItemToSubscriptionItem(raw)
  } catch (error) {
    return issuePaths(error)
  }
  throw new Error('esperava InvalidBitrixSubscriptionItemError')
}

describe('mapBitrixSpaSubscriptionItemToSubscriptionItem', () => {
  it('mapeia um item válido, traduzindo title→name e parent→subscription', () => {
    const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
      validItem({ ufCrm93GatewayId: 'si_123' }),
    )

    expect(item).toEqual({
      id: '555',
      name: 'Conector 1',
      subscription: '4242',
      status: 'active',
      metadata: { provider: 'NONE' },
      settings: DEFAULT_CONNECTOR_SETTINGS,
      vinculatedChannel: null,
      gatewayId: 'si_123',
    })
  })

  it('monta o nome do campo parent a partir do env', () => {
    expect(SUBSCRIPTION_PARENT_FIELD).toBe('parentId1142')
  })

  describe('status', () => {
    it.each([
      ['13625', 'active'],
      ['13627', 'cancelled'],
    ])('traduz o ID de enum %s para %s', (bitrixId, expected) => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ ufCrm93Status: bitrixId }),
      )

      expect(item.status).toBe(expected)
    })

    it('aceita o ID de enum como número', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ ufCrm93Status: 13627 }),
      )

      expect(item.status).toBe('cancelled')
    })

    it.each([['13999'], [null], ['']])(
      'rejeita o status %s em vez de assumir default',
      raw => {
        expect(expectInvalid(validItem({ ufCrm93Status: raw }))).toContain(
          'ufCrm93Status',
        )
      },
    )

    it('rejeita status ausente', () => {
      const { ufCrm93Status: _omitted, ...withoutStatus } = validItem()

      expect(expectInvalid(withoutStatus)).toContain('ufCrm93Status')
    })
  })

  describe('vínculo com a assinatura', () => {
    it('coage parent numérico para string', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ [SUBSCRIPTION_PARENT_FIELD]: 4242 }),
      )

      expect(item.subscription).toBe('4242')
    })

    it.each([[null], [0], ['']])('rejeita o parent %s', raw => {
      expect(
        expectInvalid(validItem({ [SUBSCRIPTION_PARENT_FIELD]: raw })),
      ).toContain(SUBSCRIPTION_PARENT_FIELD)
    })

    it('rejeita parent ausente', () => {
      const item = validItem()
      delete (item as Record<string, unknown>)[SUBSCRIPTION_PARENT_FIELD]

      expect(expectInvalid(item)).toContain(SUBSCRIPTION_PARENT_FIELD)
    })
  })

  describe('nome', () => {
    it('rejeita title ausente', () => {
      const { title: _omitted, ...withoutTitle } = validItem()

      expect(expectInvalid(withoutTitle)).toContain('title')
    })

    it('rejeita title que não é string', () => {
      expect(expectInvalid(validItem({ title: 42 }))).toContain('title')
    })
  })

  describe('gatewayId', () => {
    it.each([[null], ['']])(
      'normaliza o gateway %s para undefined',
      gatewayId => {
        const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
          validItem({ ufCrm93GatewayId: gatewayId }),
        )

        expect(item.gatewayId).toBeUndefined()
      },
    )

    it('trata gateway ausente como undefined', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(validItem())

      expect(item.gatewayId).toBeUndefined()
    })
  })

  describe('provider inferido das credenciais', () => {
    it('deriva ZAPI do par completo, sem campos de HubMessage', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem(zApiPair),
      )

      expect(item.metadata).toEqual({
        provider: 'ZAPI',
        zApiInstanceId: 'inst-1',
        zApiInstanceToken: 'tok-1',
      })
    })

    it('deriva HUBMESSAGE do par completo, corrigindo a grafia de channel', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem(hubPair),
      )

      expect(item.metadata).toEqual({
        provider: 'HUBMESSAGE',
        hubmessageChannelId: 'chan-1',
        wabaId: 'waba-1',
      })
    })

    it('deriva NONE quando os quatro campos vêm vazios', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({
          ufCrm93ZApiInstanceId: '',
          ufCrm93ZApiInstanceToken: null,
          ufCrm93HubChanelId: '',
          ufCrm93HubWabaId: null,
        }),
      )

      expect(item.metadata).toEqual({ provider: 'NONE' })
    })

    it.each([
      ['ufCrm93ZApiInstanceId', 'inst-1'],
      ['ufCrm93ZApiInstanceToken', 'tok-1'],
      ['ufCrm93HubChanelId', 'chan-1'],
      ['ufCrm93HubWabaId', 'waba-1'],
    ])('rejeita par incompleto com só %s preenchido', (field, value) => {
      const paths = expectInvalid(validItem({ [field]: value }))

      expect(paths).toContain(field)
    })

    it('rejeita dois pares preenchidos sem escolher por precedência', () => {
      const paths = expectInvalid(validItem({ ...zApiPair, ...hubPair }))

      expect(paths).toContain('ufCrm93ZApiInstanceId')
      expect(paths).toContain('ufCrm93HubChanelId')
    })
  })

  it('carrega os paths dos campos inválidos no erro', () => {
    const paths = expectInvalid({ id: 1, ufCrm93Status: 'nope' })

    expect(paths).toEqual(
      expect.arrayContaining(['title', SUBSCRIPTION_PARENT_FIELD]),
    )
  })

  describe('settings do conector', () => {
    const settingsOf = (raw: unknown) =>
      mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ ufCrm93Settings: raw }),
      ).settings

    it('lê o JSON completo dos quatro toggles', () => {
      expect(
        settingsOf(
          JSON.stringify({
            prefixOperatorNameEnabled: true,
            messageUpdateEventEnabled: false,
            messageDeleteEventEnabled: false,
            widgetOpenChannelEnabled: true,
          }),
        ),
      ).toEqual({
        prefixOperatorNameEnabled: true,
        messageUpdateEventEnabled: false,
        messageDeleteEventEnabled: false,
        widgetOpenChannelEnabled: true,
      })
    })

    it('completa com defaults um JSON parcial', () => {
      expect(
        settingsOf(JSON.stringify({ widgetOpenChannelEnabled: true })),
      ).toEqual({
        ...DEFAULT_CONNECTOR_SETTINGS,
        widgetOpenChannelEnabled: true,
      })
    })

    /**
     * Os quatro caminhos de degradação. O campo é cosmético, mas a leitura do
     * item serve billing e roteamento de mensagem — derrubá-la por causa dele
     * seria trocar um toggle errado por uma instalação fora do ar.
     */
    it.each([
      ['ausente', undefined],
      ['null', null],
      ['string vazia', ''],
      ['só espaços', '   '],
      ['JSON malformado', '{prefixOperator'],
      ['JSON de tipo errado', '"texto"'],
      [
        'shape inesperado',
        JSON.stringify({ prefixOperatorNameEnabled: 'sim' }),
      ],
      ['objeto vazio', JSON.stringify({})],
    ])('degrada para os defaults com %s', (_label, raw) => {
      expect(settingsOf(raw)).toEqual(DEFAULT_CONNECTOR_SETTINGS)
    })

    it('não invalida o item quando o JSON está torto', () => {
      expect(() =>
        mapBitrixSpaSubscriptionItemToSubscriptionItem(
          validItem({ ufCrm93Settings: '{{{' }),
        ),
      ).not.toThrow()
    })

    it('resolve settings independente do provider', () => {
      const raw = JSON.stringify({ widgetOpenChannelEnabled: true })

      for (const pair of [{}, zApiPair, hubPair]) {
        const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
          validItem({ ...pair, ufCrm93Settings: raw }),
        )

        expect(item.settings.widgetOpenChannelEnabled).toBe(true)
      }
    })
  })
})

describe('collectBitrixSpaSubscriptionItemToSubscriptionItem', () => {
  it('mapeia cada item da listagem', () => {
    const items = collectBitrixSpaSubscriptionItemToSubscriptionItem([
      validItem({ id: 1 }),
      validItem({ id: 2, ...hubPair }),
    ])

    expect(items.map(item => item.id)).toEqual(['1', '2'])
    expect(items[1]?.metadata.provider).toBe('HUBMESSAGE')
  })

  it('propaga o erro de um item inválido em vez de omiti-lo', () => {
    expect(() =>
      collectBitrixSpaSubscriptionItemToSubscriptionItem([
        validItem(),
        validItem({ ufCrm93Status: '13999' }),
      ]),
    ).toThrow(InvalidBitrixSubscriptionItemError)
  })
})

describe('mapSubscriptionItemInputToBitrixFields', () => {
  it('traduz um input de criação completo', () => {
    const fields = mapSubscriptionItemInputToBitrixFields({
      name: 'Conector 1',
      subscription: '4242',
      status: 'active',
      gatewayId: 'si_123',
      metadata: {
        provider: 'ZAPI',
        zApiInstanceId: 'inst-1',
        zApiInstanceToken: 'tok-1',
      },
    })

    expect(fields).toEqual({
      title: 'Conector 1',
      [SUBSCRIPTION_PARENT_FIELD]: '4242',
      ufCrm93Status: '13625',
      ufCrm93GatewayId: 'si_123',
      ufCrm93ZApiInstanceId: 'inst-1',
      ufCrm93ZApiInstanceToken: 'tok-1',
      ufCrm93HubChanelId: '',
      ufCrm93HubWabaId: '',
    })
  })

  it('omite os campos ausentes de um patch de um campo só', () => {
    const fields = mapSubscriptionItemInputToBitrixFields({
      status: 'cancelled',
    })

    expect(fields).toEqual({ ufCrm93Status: '13627' })
  })

  it('limpa o par do provider anterior na troca de conector', () => {
    const fields = mapSubscriptionItemInputToBitrixFields({
      metadata: {
        provider: 'HUBMESSAGE',
        hubmessageChannelId: 'chan-1',
        wabaId: 'waba-1',
      },
    })

    expect(fields).toEqual({
      ufCrm93HubChanelId: 'chan-1',
      ufCrm93HubWabaId: 'waba-1',
      ufCrm93ZApiInstanceId: '',
      ufCrm93ZApiInstanceToken: '',
    })
  })

  it('limpa os quatro campos quando o provider é NONE', () => {
    const fields = mapSubscriptionItemInputToBitrixFields({
      metadata: { provider: 'NONE' },
    })

    expect(fields).toEqual({
      ufCrm93ZApiInstanceId: '',
      ufCrm93ZApiInstanceToken: '',
      ufCrm93HubChanelId: '',
      ufCrm93HubWabaId: '',
    })
  })

  it('nunca emite o campo parent pelo caminho de patch', () => {
    const fields = mapSubscriptionItemInputToBitrixFields({
      name: 'Renomeado',
      status: 'active',
      gatewayId: 'si_1',
      metadata: { provider: 'NONE' },
    })

    expect(fields).not.toHaveProperty(SUBSCRIPTION_PARENT_FIELD)
  })

  it.each([['active'], ['cancelled']] as const)(
    'faz round-trip do status %s: domínio → ID → domínio',
    status => {
      const fields = mapSubscriptionItemInputToBitrixFields({ status })

      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ ufCrm93Status: fields.ufCrm93Status }),
      )

      expect(item.status).toBe(status)
    },
  )

  describe('settings do conector', () => {
    const settings = {
      ...DEFAULT_CONNECTOR_SETTINGS,
      widgetOpenChannelEnabled: true,
    }

    it('serializa o objeto completo dos quatro toggles', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({ settings })

      expect(fields).toEqual({ ufCrm93Settings: JSON.stringify(settings) })
      expect(
        Object.keys(JSON.parse(String(fields.ufCrm93Settings)) as object),
      ).toHaveLength(4)
    })

    it('não toca nos campos de credencial', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({ settings })

      expect(fields).not.toHaveProperty('ufCrm93ZApiInstanceId')
      expect(fields).not.toHaveProperty('ufCrm93ZApiInstanceToken')
      expect(fields).not.toHaveProperty('ufCrm93HubChanelId')
      expect(fields).not.toHaveProperty('ufCrm93HubWabaId')
    })

    it('omite o campo quando o patch não menciona settings', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({ name: 'X' })

      expect(fields).not.toHaveProperty('ufCrm93Settings')
    })

    /** Trocar de provider não pode apagar a configuração do cliente. */
    it('não toca em settings ao gravar metadata de outro provider', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({
        metadata: {
          provider: 'HUBMESSAGE',
          hubmessageChannelId: 'chan-1',
          wabaId: 'waba-1',
        },
      })

      expect(fields).not.toHaveProperty('ufCrm93Settings')
    })

    it('faz round-trip: domínio → campo → domínio', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({ settings })

      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ ufCrm93Settings: fields.ufCrm93Settings }),
      )

      expect(item.settings).toEqual(settings)
    })
  })

  describe('vínculo de canal aberto', () => {
    const settings = {
      ...DEFAULT_CONNECTOR_SETTINGS,
      widgetOpenChannelEnabled: true,
    }

    it('grava o id do canal', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({
        vinculatedChannel: '10',
      })

      expect(fields).toEqual({ ufCrm93Conector: '10' })
    })

    /** Desvincular é escrita: omitir manteria o vínculo antigo. */
    it('grava string vazia para desvincular', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({
        vinculatedChannel: null,
      })

      expect(fields).toEqual({ ufCrm93Conector: '' })
    })

    it('omite o campo quando o patch não menciona o vínculo', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({ name: 'X' })

      expect(fields).not.toHaveProperty('ufCrm93Conector')
    })

    it('não toca em settings ao gravar o vínculo, nem vice-versa', () => {
      expect(
        mapSubscriptionItemInputToBitrixFields({ vinculatedChannel: '10' }),
      ).not.toHaveProperty('ufCrm93Settings')
      expect(
        mapSubscriptionItemInputToBitrixFields({ settings }),
      ).not.toHaveProperty('ufCrm93Conector')
    })

    it.each([[null], [''], [undefined]])('lê o vínculo %s como null', raw => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ ufCrm93Conector: raw }),
      )

      expect(item.vinculatedChannel).toBeNull()
    })

    it('faz round-trip do vínculo: domínio → campo → domínio', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({
        vinculatedChannel: '10',
      })

      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ ufCrm93Conector: fields.ufCrm93Conector }),
      )

      expect(item.vinculatedChannel).toBe('10')
    })
  })
})
