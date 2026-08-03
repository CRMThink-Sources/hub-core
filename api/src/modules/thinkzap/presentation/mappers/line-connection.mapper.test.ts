import { describe, expect, it } from 'vitest'
import { mapLineConnectionToView } from './line-connection.mapper'
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

describe('mapLineConnectionToView', () => {
  it('emite o payload completo da linha conectada', () => {
    expect(
      mapLineConnectionToView({ instance: instance(), phone: phone() }),
    ).toEqual({
      connected: true,
      name: 'Acme Suporte',
      phone: '5511999998888',
      imgUrl: 'https://provider.test/foto.jpg',
      about: 'Atendimento comercial',
      deviceModel: 'iPhone 15',
      isBusiness: true,
    })
  })

  it('emite só connected quando desconectada', () => {
    expect(
      mapLineConnectionToView({
        instance: instance({ connected: false }),
        phone: null,
      }),
    ).toEqual({ connected: false })
  })

  it('trata connected ausente como false', () => {
    expect(
      mapLineConnectionToView({
        instance: instance({ connected: undefined as never }),
        phone: null,
      }),
    ).toEqual({ connected: false })
  })

  describe('degradação dos dados do aparelho', () => {
    it('emite connected true sem campos de aparelho quando phone é null', () => {
      expect(
        mapLineConnectionToView({ instance: instance(), phone: null }),
      ).toEqual({ connected: true, name: 'Instancia Comercial' })
    })

    it('omite campo por campo o que vier vazio', () => {
      const view = mapLineConnectionToView({
        instance: instance(),
        phone: phone({
          imgUrl: '',
          about: '   ',
          device: undefined as never,
        }),
      })

      expect(view).not.toHaveProperty('imgUrl')
      expect(view).not.toHaveProperty('about')
      expect(view).not.toHaveProperty('deviceModel')
      expect(view.phone).toBe('5511999998888')
    })

    it('omite isBusiness quando não vem booleano', () => {
      const view = mapLineConnectionToView({
        instance: instance(),
        phone: phone({ isBusiness: undefined as never }),
      })

      expect(view).not.toHaveProperty('isBusiness')
    })

    it('cai para o nome da instância quando o perfil não tem nome', () => {
      const view = mapLineConnectionToView({
        instance: instance({ name: 'Instancia Comercial' }),
        phone: phone({ name: '' }),
      })

      expect(view.name).toBe('Instancia Comercial')
    })

    it('omite name quando nem o perfil nem a instância têm nome', () => {
      const view = mapLineConnectionToView({
        instance: instance({ name: '' }),
        phone: phone({ name: '' }),
      })

      expect(view).not.toHaveProperty('name')
    })
  })

  describe('credencial não sai no payload', () => {
    it('NÃO emite o token da instância em nenhum lugar do payload', () => {
      const view = mapLineConnectionToView({
        instance: instance(),
        phone: phone(),
      })

      expect(view).not.toHaveProperty('token')
      expect(JSON.stringify(view)).not.toContain('TOKEN-SUPER-SECRETO')
      expect(JSON.stringify(view)).not.toContain('token')
    })

    it('não repassa campo novo do provider por spread', () => {
      const view = mapLineConnectionToView({
        instance: instance({
          campoNovoDoProvider: 'vazou',
        } as never),
        phone: phone({ outroCampoNovo: 'vazou' } as never),
      })

      expect(JSON.stringify(view)).not.toContain('vazou')
    })

    it('também não emite token quando desconectada', () => {
      const view = mapLineConnectionToView({
        instance: instance({ connected: false }),
        phone: null,
      })

      expect(JSON.stringify(view)).not.toContain('TOKEN-SUPER-SECRETO')
    })
  })
})
