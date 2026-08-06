import { describe, expect, it, vi } from 'vitest'
import { CreateLineController } from './create-line.controller'
import {
  CreateAdditionalLine,
  ManualModalityCannotCreateLineError,
  NoLineToExtendError,
  PlanDoesNotPriceProviderError,
} from '@/modules/thinkzap/application/create-additional-line'
import {
  PlanForProviderAmbiguousError,
  PlanForProviderMissingError,
} from '@/modules/thinkzap/application/helpers/build-contract-line-items'
import { ProvisionedResourceWithoutCredentialError } from '@/modules/thinkzap/application/helpers/line-resource-metadata'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { Request } from 'express'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const line: SubscriptionItem = {
  id: '90',
  name: 'WhatsApp Oficial 2',
  subscription: '100',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'chan-2',
    wabaId: 'waba-2',
  },
}

const makeController = (
  result: unknown = { kind: 'created', item: line },
  error?: Error,
) => {
  const execute = vi.fn(() =>
    error ? Promise.reject(error) : Promise.resolve(result),
  )

  return {
    controller: new CreateLineController({
      execute,
    } as unknown as CreateAdditionalLine),
    execute,
  }
}

const req = (body: unknown = {}) =>
  ({
    body,
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

const VALID = { provider: 'HUBMESSAGE', planId: '8' }

describe('POST /thinkzap/lines', () => {
  it('devolve a linha criada quando o contrato já existia no gateway', async () => {
    const { controller, execute } = makeController()

    const response = await controller.perform(req(VALID))

    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      line: {
        id: '90',
        name: 'WhatsApp Oficial 2',
        status: 'active',
        provider: 'HUBMESSAGE',
      },
    })
    expect(execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      provider: 'HUBMESSAGE',
      planId: '8',
    })
  })

  /** A credencial da linha não sai daqui: quem precisa dela é o servidor. */
  it('não devolve credencial do provider', async () => {
    const { controller } = makeController()

    const serialized = JSON.stringify(
      (await controller.perform(req(VALID))).result,
    )

    expect(serialized).not.toContain('chan-2')
    expect(serialized).not.toContain('waba-2')
  })

  it('devolve o segredo da sessão quando falta pagar', async () => {
    const { controller } = makeController({
      kind: 'checkout',
      clientSecret: 'cs_secret',
    })

    expect((await controller.perform(req(VALID))).result).toEqual({
      clientSecret: 'cs_secret',
    })
  })

  describe('corpo', () => {
    it('recusa provider fora dos dois conectores', async () => {
      const { controller, execute } = makeController()

      const response = await controller.perform(
        req({ provider: 'TELEGRAM', planId: '8' }),
      )

      expect(response.status).toBe(400)
      expect(execute).not.toHaveBeenCalled()
    })

    it('recusa corpo sem plano', async () => {
      const { controller, execute } = makeController()

      expect((await controller.perform(req({ provider: 'ZAPI' }))).status).toBe(
        400,
      )
      expect(execute).not.toHaveBeenCalled()
    })

    /**
     * `strict()`: preço, quantidade e período são derivados no servidor, e um corpo
     * que os traga é recusado em vez de ignorado. Ignorar seria equivalente hoje e
     * mentiroso no dia em que um campo homônimo entrar no schema.
     */
    it('recusa corpo que tenta escolher o preço', async () => {
      const { controller, execute } = makeController()

      const response = await controller.perform(
        req({ ...VALID, amount: 1, quantity: 5 }),
      )

      expect(response.status).toBe(400)
      expect(execute).not.toHaveBeenCalled()
    })

    /** Quem escolhe o caminho de cobrança é o estado, não o cliente. */
    it('recusa corpo que tenta escolher a intenção', async () => {
      const { controller, execute } = makeController()

      expect(
        (await controller.perform(req({ ...VALID, intent: 'add-line' })))
          .status,
      ).toBe(400)
      expect(execute).not.toHaveBeenCalled()
    })

    it('recusa instalação ausente no token', async () => {
      const { controller, execute } = makeController()

      const response = await controller.perform({
        body: VALID,
      } as unknown as Request)

      expect(response.status).toBe(400)
      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe('erros de estado', () => {
    it('plano que não precifica o conector é 400', async () => {
      const { controller } = makeController(
        undefined,
        new PlanDoesNotPriceProviderError('7', 'HUBMESSAGE'),
      )

      expect((await controller.perform(req(VALID))).status).toBe(400)
    })

    /**
     * `409` e não `400`: são conflito com o estado da instalação ou com o catálogo, e
     * nenhum se resolve mandando outro corpo — que é o que um `400` sugeriria.
     */
    it.each([
      ['sem linha para estender', new NoLineToExtendError()],
      ['modalidade manual', new ManualModalityCannotCreateLineError()],
      ['conector sem plano', new PlanForProviderMissingError('ZAPI')],
      [
        'conector com dois planos',
        new PlanForProviderAmbiguousError('ZAPI', ['7', '70']),
      ],
    ])('%s é 409', async (_name, error) => {
      const { controller } = makeController(undefined, error)

      expect((await controller.perform(req(VALID))).status).toBe(409)
    })

    /**
     * `502` e não `500`: o provider respondeu sem o dado que a linha exige. Cair no
     * `500` genérico esconderia do cliente que **nada foi cobrado**.
     */
    it('provisionamento sem credencial é 502, e a resposta diz que nada foi cobrado', async () => {
      const { controller } = makeController(
        undefined,
        new ProvisionedResourceWithoutCredentialError(
          ConnectorProvider.HUBMESSAGE,
        ),
      )

      const response = await controller.perform(req(VALID))

      expect(response.status).toBe(502)
      expect(String((response.result as { error: string }).error)).toMatch(
        /Nada foi cobrado/,
      )
    })

    it('erro inesperado sobe', async () => {
      const { controller } = makeController(
        undefined,
        new Error('bitrix fora do ar'),
      )

      await expect(controller.perform(req(VALID))).rejects.toThrow(
        'bitrix fora do ar',
      )
    })
  })
})
