import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it } from 'vitest'
import {
  SUBSCRIPTION_PARENT_FIELD,
  collectBitrixSpaSubscriptionItemToSubscriptionItem,
  mapBitrixSpaSubscriptionItemToSubscriptionItem,
  mapSubscriptionItemInputToBitrixFields,
} from './subscription-item.mapper'
import { InvalidBitrixSubscriptionItemError } from '../errors/invalid-bitrix-subscription-item.error'

/**
 * Item mínimo válido: sem credencial, sem gateway — e por isso com provider `NONE`
 * **escrito**, nunca vazio. Campo vazio é "não preenchido" e reprova o item.
 */
const validItem = (overrides: Record<string, unknown> = {}) => ({
  id: 555,
  title: 'Conector 1',
  [SUBSCRIPTION_PARENT_FIELD]: 4242,
  ufCrm93Status: '13625',
  ufCrm93Provider: 'NONE',
  ...overrides,
})

/** Credencial e provider andam juntos: item coerente declara os dois. */
const zApiPair = {
  ufCrm93Provider: 'ZAPI',
  ufCrm93ZApiInstanceId: 'inst-1',
  ufCrm93ZApiInstanceToken: 'tok-1',
}

const hubPair = {
  ufCrm93Provider: 'HUBMESSAGE',
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
      deletedAt: null,
      deletedBy: null,
    })
  })

  it('mapeia ufCrm93DeletedAt/ufCrm93DeletedBy quando preenchidos', () => {
    const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
      validItem({
        ufCrm93DeletedAt: '2026-09-10T12:00:00.000Z',
        ufCrm93DeletedBy: 'Ana Souza',
      }),
    )

    expect(item.deletedAt).toEqual(new Date('2026-09-10T12:00:00.000Z'))
    expect(item.deletedBy).toBe('Ana Souza')
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

  describe('provider declarado', () => {
    it('lê ZAPI do campo, sem campos de HubMessage', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem(zApiPair),
      )

      expect(item.metadata).toEqual({
        provider: 'ZAPI',
        zApiInstanceId: 'inst-1',
        zApiInstanceToken: 'tok-1',
      })
    })

    it('lê HUBMESSAGE do campo, corrigindo a grafia de channel', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem(hubPair),
      )

      expect(item.metadata).toEqual({
        provider: 'HUBMESSAGE',
        hubmessageChannelId: 'chan-1',
        wabaId: 'waba-1',
      })
    })

    it('lê NONE do campo quando os quatro campos vêm vazios', () => {
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

    /** Valor digitado à mão no CRM com caixa errada é o valor certo. */
    it.each([
      [' zapi ', 'ZAPI'],
      ['HubMessage', 'HUBMESSAGE'],
      ['none', 'NONE'],
    ])('normaliza %s para %s', (raw, expected) => {
      const credentials = expected === 'ZAPI' ? zApiPair : hubPair
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({
          ...(expected === 'NONE' ? {} : credentials),
          ufCrm93Provider: raw,
        }),
      )

      expect(item.metadata.provider).toBe(expected)
    })

    /**
     * Vazio é **não preenchido**, nunca `NONE`. Degradar aqui apagaria justamente a
     * distinção que o campo veio criar, e um item que ninguém preencheu sumiria da
     * lista de linhas com a mesma cara de um item de cobrança sem conector.
     */
    it.each([
      ['ausente', undefined],
      ['null', null],
      ['string vazia', ''],
      ['só espaços', '   '],
    ])('rejeita campo não preenchido: %s', (_label, raw) => {
      const paths = expectInvalid(validItem({ ufCrm93Provider: raw }))

      expect(paths).toContain('ufCrm93Provider')
    })

    /**
     * Erro, e não `undefined` com `warn` como no plano: aqui não existe estado
     * degradado útil, e chutar `NONE` removeria a linha da lista em silêncio.
     */
    it('rejeita valor desconhecido sem degradar para NONE', () => {
      const paths = expectInvalid(validItem({ ufCrm93Provider: 'TWILIO' }))

      expect(paths).toContain('ufCrm93Provider')
    })

    /**
     * A WABA só existe depois de o cliente conectar o número na Meta, e o
     * provisionamento devolve o canal e nada mais. Exigir o par tornava a linha do
     * WhatsApp Oficial impossível de gravar — nem o trial conseguia.
     */
    it('aceita HUBMESSAGE com canal e sem WABA', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({
          ufCrm93Provider: 'HUBMESSAGE',
          ufCrm93HubChanelId: 'chan-1',
          ufCrm93HubWabaId: '',
        }),
      )

      expect(item.metadata).toEqual({
        provider: 'HUBMESSAGE',
        hubmessageChannelId: 'chan-1',
      })
    })

    /** `''` no domínio passaria por toda checagem de presença e falharia no provider. */
    it('omite a WABA em vez de gravar string vazia', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({
          ufCrm93Provider: 'HUBMESSAGE',
          ufCrm93HubChanelId: 'chan-1',
          ufCrm93HubWabaId: '',
        }),
      )

      expect(item.metadata).not.toHaveProperty('wabaId')
    })
  })

  describe('coerência entre provider declarado e credencial', () => {
    it.each([
      ['ufCrm93ZApiInstanceId', 'inst-1'],
      ['ufCrm93ZApiInstanceToken', 'tok-1'],
    ])(
      'rejeita par incompleto da Z-API com só %s preenchido',
      (field, value) => {
        const paths = expectInvalid(
          validItem({ ufCrm93Provider: 'ZAPI', [field]: value }),
        )

        expect(paths).toContain(field)
      },
    )

    /**
     * O ganho central do campo: antes isto lia `{ provider: 'NONE' }` e a linha
     * sumia da lista sem nada apontar a causa.
     */
    it('rejeita ZAPI declarado sem nenhuma credencial', () => {
      const paths = expectInvalid(validItem({ ufCrm93Provider: 'ZAPI' }))

      expect(paths).toContain('ufCrm93ZApiInstanceId')
    })

    it('rejeita HUBMESSAGE declarado sem o id do canal', () => {
      const paths = expectInvalid(validItem({ ufCrm93Provider: 'HUBMESSAGE' }))

      expect(paths).toContain('ufCrm93HubChanelId')
    })

    /** WABA sem canal é credencial órfã: não identifica recurso nenhum. */
    it('rejeita WABA sem o id do canal', () => {
      const paths = expectInvalid(
        validItem({
          ufCrm93Provider: 'HUBMESSAGE',
          ufCrm93HubChanelId: '',
          ufCrm93HubWabaId: 'waba-1',
        }),
      )

      expect(paths).toContain('ufCrm93HubWabaId')
    })

    it('rejeita ZAPI declarado com credencial da HubMessage', () => {
      const paths = expectInvalid(
        validItem({ ...zApiPair, ufCrm93HubChanelId: 'chan-1' }),
      )

      expect(paths).toContain('ufCrm93HubChanelId')
    })

    it('rejeita HUBMESSAGE declarado com credencial da Z-API', () => {
      const paths = expectInvalid(
        validItem({ ...hubPair, ...zApiPair, ufCrm93Provider: 'HUBMESSAGE' }),
      )

      expect(paths).toContain('ufCrm93ZApiInstanceId')
    })

    it.each([
      ['Z-API', zApiPair],
      ['HubMessage', hubPair],
    ])('rejeita NONE declarado com credencial da %s', (_label, pair) => {
      const paths = expectInvalid(
        validItem({ ...pair, ufCrm93Provider: 'NONE' }),
      )

      expect(paths).toContain('ufCrm93Provider')
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

    it('lê o JSON completo dos dois toggles', () => {
      expect(
        settingsOf(
          JSON.stringify({
            prefixOperatorNameEnabled: true,
            widgetOpenChannelEnabled: true,
          }),
        ),
      ).toEqual({
        prefixOperatorNameEnabled: true,
        widgetOpenChannelEnabled: true,
      })
    })

    /**
     * O shape que quase todo item da SPA tem hoje. A chave descontinuada é
     * descartada e as três restantes mantêm o valor do cliente — cair nos defaults
     * aqui religaria `prefixOperatorNameEnabled` na base inteira, em silêncio.
     */
    it('ignora as chaves descontinuadas sem cair nos defaults', () => {
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
      ufCrm93Provider: 'ZAPI',
      ufCrm93ZApiInstanceId: 'inst-1',
      ufCrm93ZApiInstanceToken: 'tok-1',
      ufCrm93HubChanelId: '',
      ufCrm93HubWabaId: '',
    })
  })

  it('traduz deletedAt/deletedBy da exclusão', () => {
    const fields = mapSubscriptionItemInputToBitrixFields({
      status: 'cancelled',
      deletedAt: new Date('2026-09-10T12:00:00.000Z'),
      deletedBy: 'Ana Souza',
    })

    expect(fields).toEqual({
      ufCrm93Status: '13627',
      ufCrm93DeletedAt: '2026-09-10T12:00:00.000Z',
      ufCrm93DeletedBy: 'Ana Souza',
    })
  })

  it('omite deletedAt/deletedBy quando ausentes do input (não apaga o que já está gravado)', () => {
    const fields = mapSubscriptionItemInputToBitrixFields({ status: 'active' })

    expect(fields).not.toHaveProperty('ufCrm93DeletedAt')
    expect(fields).not.toHaveProperty('ufCrm93DeletedBy')
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
      ufCrm93Provider: 'HUBMESSAGE',
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
      ufCrm93Provider: 'NONE',
      ufCrm93ZApiInstanceId: '',
      ufCrm93ZApiInstanceToken: '',
      ufCrm93HubChanelId: '',
      ufCrm93HubWabaId: '',
    })
  })

  /**
   * O provider não tem caminho próprio de escrita: ou sai junto com a credencial,
   * ou não sai. É o que impede a escrita de produzir o item incoerente que a
   * leitura passou a recusar.
   */
  it('não toca o provider num patch que não traz metadata', () => {
    const fields = mapSubscriptionItemInputToBitrixFields({
      settings: DEFAULT_CONNECTOR_SETTINGS,
      status: 'active',
    })

    expect(fields).not.toHaveProperty('ufCrm93Provider')
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

    it('serializa o objeto completo dos dois toggles', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({ settings })

      expect(fields).toEqual({ ufCrm93Settings: JSON.stringify(settings) })
      expect(
        Object.keys(JSON.parse(String(fields.ufCrm93Settings)) as object),
      ).toHaveLength(2)
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

  /**
   * Item criado à mão no CRM: provider declarado, credencial vazia. É **ilegal** para
   * esta leitura de propósito, e é a entrada do job de provisionamento — que grava o
   * `metadata` por este mesmo mapper.
   *
   * O que se trava aqui é o fechamento do ciclo: o que o job escreve tem que voltar
   * como item válido. Sem isso, o provisionamento poderia "dar certo" e deixar a
   * assinatura inteira sem conseguir ser lida, que é o sintoma que ele existe para
   * eliminar.
   */
  describe('item criado à mão, antes e depois do provisionamento', () => {
    const manualItem = (provider: string) =>
      validItem({
        ufCrm93Provider: provider,
        ufCrm93ZApiInstanceId: '',
        ufCrm93ZApiInstanceToken: '',
        ufCrm93HubChanelId: '',
        ufCrm93HubWabaId: '',
      })

    it.each([['ZAPI'], ['HUBMESSAGE']])(
      'item %s sem credencial é recusado antes do job rodar',
      provider => {
        expect(expectInvalid(manualItem(provider))).toContain('ufCrm93Provider')
      },
    )

    it('o que o job grava para ZAPI volta como item válido', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({
        metadata: {
          provider: 'ZAPI',
          zApiInstanceId: 'inst-2',
          zApiInstanceToken: 'tok-2',
        },
      })

      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ ...manualItem('ZAPI'), ...fields }),
      )

      expect(item.metadata).toEqual({
        provider: 'ZAPI',
        zApiInstanceId: 'inst-2',
        zApiInstanceToken: 'tok-2',
      })
    })

    /** Canal sem WABA é o que o provisionamento do HubMessage devolve — e é válido. */
    it('o que o job grava para HUBMESSAGE volta como item válido, sem WABA', () => {
      const fields = mapSubscriptionItemInputToBitrixFields({
        metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'chan-2' },
      })

      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        validItem({ ...manualItem('HUBMESSAGE'), ...fields }),
      )

      expect(item.metadata).toEqual({
        provider: 'HUBMESSAGE',
        hubmessageChannelId: 'chan-2',
      })
    })

    /** Item de cobrança declarado: `NONE` sem credencial é válido dos dois lados. */
    it('item NONE sem credencial já é válido sem o job tocar nele', () => {
      const item = mapBitrixSpaSubscriptionItemToSubscriptionItem(
        manualItem('NONE'),
      )

      expect(item.metadata).toEqual({ provider: 'NONE' })
    })
  })
})
