import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { buildThinkzapRobotUpdateParams } from './build-thinkzap-robot-add-params'
import { syncThinkzapRobotConnectorOptions } from './sync-robot-connectors'

const execute = vi.fn()
const getInstance = vi.fn()

/**
 * As opções do robô passaram a ser montadas pelos **itens de assinatura**, keyed
 * pelo id do item. Era `listConnectors`, que devolvia vazio para linha nascida na
 * SPA — o robô ficava sem opção de linha e o usuário não conseguia configurar o
 * envio.
 */
vi.mock('@/modules/application/main/make-get-aplication-context', () => ({
  makeGetAplicationContext: () => ({ execute }),
}))

vi.mock(
  '@/shared/infra/persistence/repositories/prisma-installed-app.repository',
  () => ({
    PrismaInstalledAppRepository: class {
      getById = vi.fn().mockResolvedValue({
        id: 'app-1',
        domainId: 'domain-1',
        appCodeId: 'crmthink.thinkzap',
      })
    },
  }),
)

vi.mock('../infra/clients/z-api.client', () => ({
  ZApiClient: class {
    getInstance = getInstance
  },
}))

vi.mock('@/shared/main/make-bitrix-client', () => ({
  makeBitrixClientByAppId: vi.fn(),
}))

const zapiItem = (id: string, name = 'Linha') => ({
  id,
  name,
  subscription: 'sub-1',
  status: 'active' as const,
  settings: {},
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI' as const,
    zApiInstanceId: `z-${id}`,
    zApiInstanceToken: 'token',
  },
})

const contextWith = (items: unknown[]) => ({
  customer: { id: 'domain-1', name: 'acme' },
  aplication: { id: 'app-1', spaId: '42' },
  subscriptions: [{ id: 'sub-1', items }],
})

describe('syncThinkzapRobotConnectorOptions', () => {
  const callMethod = vi.fn()

  const optionsFromLastCall = (): Record<string, string> | undefined => {
    const params = callMethod.mock.calls.at(-1)?.[1] as
      | {
          FIELDS: {
            PROPERTIES: { connector: { Options: Record<string, string> } }
          }
        }
      | undefined

    return params?.FIELDS.PROPERTIES.connector.Options
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(makeBitrixClientByAppId).mockResolvedValue({
      callMethod,
    } as never)
    execute.mockResolvedValue(contextWith([zapiItem('i1')]))
    getInstance.mockResolvedValue({ name: 'ThinkZap | Comercial' })
  })

  it('monta as opções pelo id do item, sem filtro de tipo de documento', async () => {
    await syncThinkzapRobotConnectorOptions('app-1')

    const expected = buildThinkzapRobotUpdateParams()
    expected.FIELDS.PROPERTIES.connector.Options = { i1: 'Comercial' }

    expect(callMethod).toHaveBeenCalledWith('bizproc.robot.update', expected)

    const params = callMethod.mock.calls[0]?.[1] as
      | { FIELDS: Record<string, unknown> }
      | undefined
    expect(params?.FIELDS).not.toHaveProperty('FILTER')
  })

  /** O nome do item é o fallback: é o que o cliente reconhece na lista. */
  it('usa o nome do item quando a Z-API não devolve nome', async () => {
    execute.mockResolvedValue(contextWith([zapiItem('i1', 'Comercial SP')]))
    getInstance.mockResolvedValue({ connected: false })

    await syncThinkzapRobotConnectorOptions('app-1')

    expect(optionsFromLastCall()).toEqual({ i1: 'Comercial SP' })
  })

  it('usa o nome do item quando a leitura da Z-API falha', async () => {
    execute.mockResolvedValue(contextWith([zapiItem('i1', 'Suporte')]))
    getInstance.mockRejectedValue(new Error('Failed to get instance data'))

    await syncThinkzapRobotConnectorOptions('app-1')

    expect(callMethod).toHaveBeenCalledTimes(1)
    expect(optionsFromLastCall()).toEqual({ i1: 'Suporte' })
  })

  it('segue sincronizando as demais linhas quando uma falha', async () => {
    execute.mockResolvedValue(
      contextWith([zapiItem('quebrada', 'Quebrada'), zapiItem('ok', 'OK')]),
    )
    getInstance
      .mockRejectedValueOnce(new Error('Failed to get instance data'))
      .mockResolvedValue({ name: 'ThinkZap | Viva' })

    await syncThinkzapRobotConnectorOptions('app-1')

    expect(optionsFromLastCall()).toEqual({ quebrada: 'Quebrada', ok: 'Viva' })
  })

  /** Item de cobrança sem conector não é linha e não pode virar opção do robô. */
  it('ignora item sem provider', async () => {
    execute.mockResolvedValue(
      contextWith([
        { ...zapiItem('cobranca'), metadata: { provider: 'NONE' as const } },
        zapiItem('i1'),
      ]),
    )

    await syncThinkzapRobotConnectorOptions('app-1')

    expect(optionsFromLastCall()).toEqual({ i1: 'Comercial' })
  })

  it('devolve opções vazias quando a instalação não tem linha', async () => {
    execute.mockResolvedValue(contextWith([]))

    await syncThinkzapRobotConnectorOptions('app-1')

    expect(optionsFromLastCall()).toEqual({})
  })
})
