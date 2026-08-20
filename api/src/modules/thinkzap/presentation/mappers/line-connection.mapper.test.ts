import { describe, expect, it } from 'vitest'
import { mapLineConnectionToView } from './line-connection.mapper'
import type { ZApiLineConnectionReading } from '@/modules/thinkzap/application/get-line-connection'
import type { LineEntitlement } from '@/modules/thinkzap/domain/connector-trial'
import type {
  InstanceDataResponse,
  PhoneDataResponse,
} from '@/modules/thinkzap/infra/clients/types/z-api.types'

/** Shape real da Z-API, com o `token` que a resposta crua traz. */
const instance = (
  overrides: Partial<InstanceDataResponse> = {},
): InstanceDataResponse =>
  ({
    connected: true,
    name: 'Instancia Comercial',
    token: 'TOKEN-SUPER-SECRETO',
    due: 0,
    paymentStatus: 'active',
    id: 'Z-1',
    created: '2026-07-01',
    ...overrides,
  }) as InstanceDataResponse

const phone = (overrides: Partial<PhoneDataResponse> = {}): PhoneDataResponse =>
  ({
    phone: '5511999998888',
    lid: 'lid-1',
    imgUrl: 'https://provider.test/foto.jpg',
    about: 'Atendimento comercial',
    name: 'Acme Suporte',
    device: { sessionName: 's', device_model: 'iPhone 15' },
    originalDevice: 'ios',
    sessionId: 1,
    isBusiness: true,
    ...overrides,
  }) as PhoneDataResponse

/**
 * `active` por default: o entitlement é ortogonal a tudo que estes testes medem, e
 * repeti-lo em cada caso esconderia o que cada um afirma.
 */
const reading = (
  overrides: Partial<ZApiLineConnectionReading> = {},
): ZApiLineConnectionReading => ({
  provider: 'ZAPI',
  instance: instance(),
  phone: phone(),
  entitlement: 'active',
  ...overrides,
})

describe('mapLineConnectionToView', () => {
  it('emite o payload completo da linha conectada', () => {
    expect(mapLineConnectionToView(reading())).toEqual({
      provider: 'ZAPI',
      connected: true,
      entitlement: 'active',
      name: 'Acme Suporte',
      phone: '5511999998888',
      imgUrl: 'https://provider.test/foto.jpg',
      about: 'Atendimento comercial',
      deviceModel: 'iPhone 15',
      isBusiness: true,
    })
  })

  it('emite só connected e entitlement quando desconectada', () => {
    expect(
      mapLineConnectionToView(
        reading({ instance: instance({ connected: false }), phone: null }),
      ),
    ).toEqual({ provider: 'ZAPI', connected: false, entitlement: 'active' })
  })

  it('trata connected ausente como false', () => {
    expect(
      mapLineConnectionToView(
        reading({
          instance: instance({ connected: undefined as never }),
          phone: null,
        }),
      ),
    ).toEqual({ provider: 'ZAPI', connected: false, entitlement: 'active' })
  })

  /**
   * A leitura de conexão **não** recusa linha bloqueada: ela reporta o estado, e é
   * a tela que troca o QR code pela explicação. Por isso o entitlement sai no
   * payload em qualquer valor, inclusive com a linha desconectada.
   */
  describe('entitlement sai no payload', () => {
    const cases: LineEntitlement[] = ['active', 'trial-expired', 'inactive']

    it.each(cases)('repassa %s sem alterar', entitlement => {
      expect(
        mapLineConnectionToView(reading({ entitlement })).entitlement,
      ).toBe(entitlement)
    })

    it('sai também quando a linha está desconectada', () => {
      const view = mapLineConnectionToView(
        reading({
          instance: instance({ connected: false }),
          phone: null,
          entitlement: 'trial-expired',
        }),
      )

      expect(view).toEqual({
        provider: 'ZAPI',
        connected: false,
        entitlement: 'trial-expired',
      })
    })
  })

  describe('degradação dos dados do aparelho', () => {
    it('emite connected true sem campos de aparelho quando phone é null', () => {
      expect(mapLineConnectionToView(reading({ phone: null }))).toEqual({
        provider: 'ZAPI',
        connected: true,
        entitlement: 'active',
        name: 'Instancia Comercial',
      })
    })

    it('omite campo por campo o que vier vazio', () => {
      const view = mapLineConnectionToView(
        reading({
          phone: phone({
            imgUrl: '',
            about: '   ',
            device: undefined as never,
          }),
        }),
      )

      expect(view).not.toHaveProperty('imgUrl')
      expect(view).not.toHaveProperty('about')
      expect(view).not.toHaveProperty('deviceModel')
      expect(view.phone).toBe('5511999998888')
    })

    it('omite isBusiness quando não vem booleano', () => {
      const view = mapLineConnectionToView(
        reading({ phone: phone({ isBusiness: undefined as never }) }),
      )

      expect(view).not.toHaveProperty('isBusiness')
    })

    it('cai para o nome da instância quando o perfil não tem nome', () => {
      const view = mapLineConnectionToView(
        reading({
          instance: instance({ name: 'Instancia Comercial' }),
          phone: phone({ name: '' }),
        }),
      )

      expect(view.name).toBe('Instancia Comercial')
    })

    it('omite name quando nem o perfil nem a instância têm nome', () => {
      const view = mapLineConnectionToView(
        reading({
          instance: instance({ name: '' }),
          phone: phone({ name: '' }),
        }),
      )

      expect(view).not.toHaveProperty('name')
    })
  })

  describe('credencial não sai no payload', () => {
    it('NÃO emite o token da instância em nenhum lugar do payload', () => {
      const view = mapLineConnectionToView(reading())

      expect(view).not.toHaveProperty('token')
      expect(JSON.stringify(view)).not.toContain('TOKEN-SUPER-SECRETO')
      expect(JSON.stringify(view)).not.toContain('token')
    })

    it('não repassa campo novo do provider por spread', () => {
      const view = mapLineConnectionToView(
        reading({
          instance: instance({ campoNovoDoProvider: 'vazou' } as never),
          phone: phone({ outroCampoNovo: 'vazou' } as never),
        }),
      )

      expect(JSON.stringify(view)).not.toContain('vazou')
    })

    it('também não emite token quando desconectada', () => {
      const view = mapLineConnectionToView(
        reading({ instance: instance({ connected: false }), phone: null }),
      )

      expect(JSON.stringify(view)).not.toContain('TOKEN-SUPER-SECRETO')
    })

    it('também não emite token quando a linha está bloqueada', () => {
      const view = mapLineConnectionToView(
        reading({ entitlement: 'trial-expired' }),
      )

      expect(JSON.stringify(view)).not.toContain('TOKEN-SUPER-SECRETO')
    })
  })

  /**
   * Linha oficial: o payload é o que a HubMessage sabe dizer, e só. Nada de
   * `name`/`phone`/`imgUrl` — o que existe do lado dela é o `phoneId`, que não é o
   * número do cliente.
   */
  describe('linha HubMessage', () => {
    it('emite provider, connected, entitlement e a WABA', () => {
      expect(
        mapLineConnectionToView({
          provider: 'HUBMESSAGE',
          connected: true,
          wabaId: 'W-9',
          entitlement: 'active',
        }),
      ).toEqual({
        provider: 'HUBMESSAGE',
        connected: true,
        wabaId: 'W-9',
        entitlement: 'active',
      })
    })

    it('omite wabaId enquanto o número não foi conectado', () => {
      const view = mapLineConnectionToView({
        provider: 'HUBMESSAGE',
        connected: false,
        wabaId: null,
        entitlement: 'active',
      })

      expect(view).toEqual({
        provider: 'HUBMESSAGE',
        connected: false,
        entitlement: 'active',
      })
      expect(view).not.toHaveProperty('wabaId')
    })

    it('reporta a habilitação da linha bloqueada', () => {
      const view = mapLineConnectionToView({
        provider: 'HUBMESSAGE',
        connected: true,
        wabaId: 'W-9',
        entitlement: 'trial-expired',
      })

      expect(view.entitlement).toBe('trial-expired')
    })
  })
})
