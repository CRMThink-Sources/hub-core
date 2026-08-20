import { Request } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SpaWebhookController } from './spa-webhook.controller'
import { InvalidateSpaCache } from '@/modules/application/application/invalidate-spa-cache'
import { env } from '@/config/env'
import { apiLogger } from '@/shared/infra/logger'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const TOKEN = 'application_token_do_webhook'
const SPA = env.payments.spa

/** As filas entram como funções — o controller não conhece os casos de uso. */
const enqueue = vi.fn(() => Promise.resolve({ id: 'job-1' }))
const enqueueCleanup = vi.fn(() => Promise.resolve({ id: 'job-2' }))
const enqueueStatusSync = vi.fn(() => Promise.resolve({ id: 'job-3' }))
const unlinkAplicationSpaItem = vi.fn(() => Promise.resolve())

const effects = {
  enqueueProvisioning: enqueue,
  enqueueCleanup,
  enqueueStatusSync,
  unlinkAplicationSpaItem,
}

/** Os mesmos efeitos com um deles falhando, para o caminho de 200 com log. */
const failingEffects = (
  key: keyof typeof effects,
  error = new Error('redis fora'),
) => ({
  ...effects,
  [key]: vi.fn(() => Promise.reject(error)),
})

const makeInvalidate = () => {
  const execute = vi.fn(() =>
    Promise.resolve({ handled: true, deletedKeys: 3 }),
  )

  return {
    invalidate: { execute } as unknown as InvalidateSpaCache,
    execute,
  }
}

/** Corpo como o `express.urlencoded({ extended: true })` entrega. */
const formBody = (overrides: {
  event?: string
  id?: string
  entityTypeId?: string
  token?: string
}) => ({
  event: overrides.event,
  data: {
    FIELDS: {
      ...(overrides.id !== undefined && { ID: overrides.id }),
      ...(overrides.entityTypeId !== undefined && {
        ENTITY_TYPE_ID: overrides.entityTypeId,
      }),
    },
  },
  auth: {
    application_token: overrides.token ?? TOKEN,
    domain: 'crmthink.bitrix24.com.br',
  },
})

const reqWith = (body: unknown) => ({ body }) as unknown as Request

describe('SpaWebhookController', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invalida o cache quando o application token confere', async () => {
    const { invalidate, execute } = makeInvalidate()

    const response = await new SpaWebhookController(
      invalidate,
      TOKEN,
      effects,
    ).perform(
      reqWith(formBody({ event: 'ONCRMDYNAMICITEMUPDATE_1142', id: '42' })),
    )

    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionEntityType,
      itemId: '42',
      verb: 'UPDATE',
    })
  })

  it('lê o corpo aninhado do formulário do Bitrix', async () => {
    const { invalidate, execute } = makeInvalidate()

    await new SpaWebhookController(invalidate, TOKEN, effects).perform(
      reqWith({
        event: 'ONCRMDYNAMICITEMADD_1146',
        data: { FIELDS: { ID: '9', ENTITY_TYPE_ID: '1146' } },
        auth: { application_token: TOKEN, domain: 'x.bitrix24.com.br' },
      }),
    )

    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionItemEntityType,
      itemId: '9',
      verb: 'ADD',
    })
  })

  it('aceita ID numérico e o normaliza para string', async () => {
    const { invalidate, execute } = makeInvalidate()

    await new SpaWebhookController(invalidate, TOKEN, effects).perform(
      reqWith({
        event: 'ONCRMDYNAMICITEMUPDATE_1142',
        data: { FIELDS: { ID: 42 } },
        auth: { application_token: TOKEN },
      }),
    )

    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionEntityType,
      itemId: '42',
      verb: 'UPDATE',
    })
  })

  it('repassa o verbo do evento ao invalidador — é ele que decide a leitura do pai', async () => {
    const { invalidate, execute } = makeInvalidate()
    const controller = new SpaWebhookController(invalidate, TOKEN, effects)

    await controller.perform(
      reqWith(formBody({ event: 'ONCRMDYNAMICITEMDELETE_1146', id: '9' })),
    )

    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionItemEntityType,
      itemId: '9',
      verb: 'DELETE',
    })
  })

  it('cai para ENTITY_TYPE_ID quando o evento não traz o sufixo', async () => {
    const { invalidate, execute } = makeInvalidate()

    await new SpaWebhookController(invalidate, TOKEN, effects).perform(
      reqWith(
        formBody({ event: 'ONCRMITEMUPDATE', id: '5', entityTypeId: '1138' }),
      ),
    )

    // `ONCRMITEMUPDATE` não é o padrão de SPA dinâmica: o `entityTypeId` vem do campo,
    // e o verbo fica `UNKNOWN` — nenhum efeito é despachado por evento assim.
    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.planEntityType,
      itemId: '5',
      verb: 'UNKNOWN',
    })
  })

  it('responde 401 e não invalida nada quando o token diverge', async () => {
    const { invalidate, execute } = makeInvalidate()

    const response = await new SpaWebhookController(
      invalidate,
      TOKEN,
      effects,
    ).perform(
      reqWith(
        formBody({
          event: 'ONCRMDYNAMICITEMUPDATE_1142',
          id: '42',
          token: 'outro_token_de_mesmo_tamanho!!',
        }),
      ),
    )

    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('responde 401 quando o token está ausente', async () => {
    const { invalidate, execute } = makeInvalidate()

    const response = await new SpaWebhookController(
      invalidate,
      TOKEN,
      effects,
    ).perform(
      reqWith({
        event: 'ONCRMDYNAMICITEMUPDATE_1142',
        data: { FIELDS: { ID: '42' } },
      }),
    )

    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('responde 503 e não invalida nada quando o segredo não está configurado', async () => {
    const { invalidate, execute } = makeInvalidate()

    const response = await new SpaWebhookController(
      invalidate,
      '',
      effects,
    ).perform(
      reqWith(formBody({ event: 'ONCRMDYNAMICITEMUPDATE_1142', id: '42' })),
    )

    expect(response.status).toBe(503)
    expect(execute).not.toHaveBeenCalled()
  })

  it('responde 200 sem invalidar quando o evento é irreconhecível', async () => {
    const { invalidate, execute } = makeInvalidate()

    const response = await new SpaWebhookController(
      invalidate,
      TOKEN,
      effects,
    ).perform(reqWith(formBody({ event: 'ONAPPINSTALL' })))

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ handled: false })
    expect(execute).not.toHaveBeenCalled()
  })

  it('delega SPA fora do escopo de billing ao invalidador, que a ignora', async () => {
    const { invalidate, execute } = makeInvalidate()
    execute.mockResolvedValueOnce({ handled: false, deletedKeys: 0 })

    const response = await new SpaWebhookController(
      invalidate,
      TOKEN,
      effects,
    ).perform(
      reqWith(formBody({ event: 'ONCRMDYNAMICITEMUPDATE_1050', id: '1' })),
    )

    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({
      entityTypeId: 1050,
      itemId: '1',
      verb: 'UPDATE',
    })
  })

  it('responde 200 quando o payload não traz id de item', async () => {
    const { invalidate, execute } = makeInvalidate()
    execute.mockResolvedValueOnce({ handled: true, deletedKeys: 0 })

    const response = await new SpaWebhookController(
      invalidate,
      TOKEN,
      effects,
    ).perform(reqWith(formBody({ event: 'ONCRMDYNAMICITEMUPDATE_1142' })))

    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionEntityType,
      itemId: undefined,
      verb: 'UPDATE',
    })
  })

  it('responde 401 quando o corpo não casa com o schema', async () => {
    const { invalidate, execute } = makeInvalidate()

    const response = await new SpaWebhookController(
      invalidate,
      TOKEN,
      effects,
    ).perform(reqWith('não é objeto'))

    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  describe('despacho do provisionamento', () => {
    it('criação de item de assinatura enfileira uma vez, depois de invalidar', async () => {
      const { invalidate, execute } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        effects,
      ).perform(
        reqWith(
          formBody({
            event: `ONCRMDYNAMICITEMADD_${SPA.subscriptionItemEntityType}`,
            id: '77',
          }),
        ),
      )

      expect(response.status).toBe(200)
      expect(execute).toHaveBeenCalledWith({
        entityTypeId: SPA.subscriptionItemEntityType,
        itemId: '77',
        verb: 'ADD',
      })
      expect(enqueue).toHaveBeenCalledTimes(1)
      // `traceKey` derivado do id, não aleatório: é o que correlaciona a linha do
      // webhook com a do worker no log.
      expect(enqueue).toHaveBeenCalledWith({
        itemId: '77',
        traceKey: 'spa-item-77',
      })
      // A invalidação vem primeiro: o job relê o item, e o cache velho o
      // faria correr contra uma cópia obsoleta da própria SPA.
      expect(execute.mock.invocationCallOrder[0]!).toBeLessThan(
        enqueue.mock.invocationCallOrder[0]!,
      )
    })

    /**
     * Trocar o provider de um item já provisionado é destruir um recurso e criar outro,
     * com QR code novo para o cliente: operação própria, não efeito colateral de editar
     * campo. O update tem efeito **próprio** — a sincronização de status —, e é ele que o
     * despacha.
     */
    it('update e delete de item não enfileiram provisionamento', async () => {
      for (const verb of ['UPDATE', 'DELETE']) {
        const { invalidate, execute } = makeInvalidate()

        await new SpaWebhookController(invalidate, TOKEN, effects).perform(
          reqWith(
            formBody({
              event: `ONCRMDYNAMICITEM${verb}_${SPA.subscriptionItemEntityType}`,
              id: '77',
            }),
          ),
        )

        expect(execute).toHaveBeenCalled()
        expect(enqueue).not.toHaveBeenCalled()
        vi.clearAllMocks()
      }
    })

    it('criação nas outras SPAs de billing não enfileira', async () => {
      const others = [
        SPA.subscriptionEntityType,
        SPA.planEntityType,
        SPA.productEntityType,
        SPA.aplicationEntityType,
      ]

      for (const entityTypeId of others) {
        const { invalidate, execute } = makeInvalidate()

        await new SpaWebhookController(invalidate, TOKEN, effects).perform(
          reqWith(
            formBody({ event: `ONCRMDYNAMICITEMADD_${entityTypeId}`, id: '5' }),
          ),
        )

        expect(execute).toHaveBeenCalled()
        expect(enqueue).not.toHaveBeenCalled()
        vi.clearAllMocks()
      }
    })

    /**
     * O payload **real** do portal: evento sem sufixo de SPA, e a SPA só em
     * `data[FIELDS][ENTITY_TYPE_ID]`. Era o caso que caía em `UNKNOWN` e não
     * provisionava nada — o verbo estava no nome do evento, e a regex não o via sem o
     * sufixo.
     */
    it('evento sem sufixo de SPA enfileira: o verbo vem do nome do evento', async () => {
      const { invalidate, execute } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        effects,
      ).perform(
        reqWith(
          formBody({
            event: 'ONCRMDYNAMICITEMADD',
            entityTypeId: String(SPA.subscriptionItemEntityType),
            id: '25',
          }),
        ),
      )

      expect(response.status).toBe(200)
      expect(execute).toHaveBeenCalledWith({
        entityTypeId: SPA.subscriptionItemEntityType,
        itemId: '25',
        verb: 'ADD',
      })
      expect(enqueue).toHaveBeenCalledWith({
        itemId: '25',
        traceKey: 'spa-item-25',
      })
    })

    it('update sem sufixo de SPA não provisiona — sincroniza status', async () => {
      const { invalidate, execute } = makeInvalidate()

      await new SpaWebhookController(invalidate, TOKEN, effects).perform(
        reqWith(
          formBody({
            event: 'ONCRMDYNAMICITEMUPDATE',
            entityTypeId: String(SPA.subscriptionItemEntityType),
            id: '25',
          }),
        ),
      )

      expect(execute).toHaveBeenCalled()
      expect(enqueue).not.toHaveBeenCalled()
      expect(enqueueStatusSync).toHaveBeenCalledWith({
        itemId: '25',
        traceKey: 'spa-item-25',
      })
    })

    it('evento sem sufixo de outra SPA não enfileira', async () => {
      const { invalidate, execute } = makeInvalidate()

      await new SpaWebhookController(invalidate, TOKEN, effects).perform(
        reqWith(
          formBody({
            event: 'ONCRMDYNAMICITEMADD',
            entityTypeId: String(SPA.subscriptionEntityType),
            id: '25',
          }),
        ),
      )

      expect(execute).toHaveBeenCalledWith({
        entityTypeId: SPA.subscriptionEntityType,
        itemId: '25',
        verb: 'ADD',
      })
      expect(enqueue).not.toHaveBeenCalled()
    })

    /** Sufixo e campo divergindo: o nome do evento diz a qual binding o Bitrix entrega. */
    it('sufixo do evento tem precedência sobre ENTITY_TYPE_ID', async () => {
      const { invalidate, execute } = makeInvalidate()

      await new SpaWebhookController(invalidate, TOKEN, effects).perform(
        reqWith(
          formBody({
            event: `ONCRMDYNAMICITEMADD_${SPA.subscriptionItemEntityType}`,
            entityTypeId: String(SPA.planEntityType),
            id: '25',
          }),
        ),
      )

      expect(execute).toHaveBeenCalledWith({
        entityTypeId: SPA.subscriptionItemEntityType,
        itemId: '25',
        verb: 'ADD',
      })
      expect(enqueue).toHaveBeenCalledTimes(1)
    })

    it('criação sem id de item registra warn e não enfileira', async () => {
      const { invalidate } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        effects,
      ).perform(
        reqWith(
          formBody({
            event: `ONCRMDYNAMICITEMADD_${SPA.subscriptionItemEntityType}`,
          }),
        ),
      )

      expect(response.status).toBe(200)
      expect(enqueue).not.toHaveBeenCalled()
      expect(apiLogger.warn).toHaveBeenCalled()
    })

    it('payload sem nome de evento não enfileira', async () => {
      const { invalidate, execute } = makeInvalidate()

      await new SpaWebhookController(invalidate, TOKEN, effects).perform(
        reqWith(
          formBody({
            entityTypeId: String(SPA.subscriptionItemEntityType),
            id: '77',
          }),
        ),
      )

      // Sem nome de evento não há verbo: assumir `ADD` criaria instância que
      // ninguém pediu.
      expect(execute).toHaveBeenCalled()
      expect(enqueue).not.toHaveBeenCalled()
    })

    it('nome de evento irreconhecível não enfileira', async () => {
      const { invalidate, execute } = makeInvalidate()

      await new SpaWebhookController(invalidate, TOKEN, effects).perform(
        reqWith(
          formBody({
            event: 'ONCRMDYNAMICITEMWHATEVER',
            entityTypeId: String(SPA.subscriptionItemEntityType),
            id: '77',
          }),
        ),
      )

      expect(execute).toHaveBeenCalled()
      expect(enqueue).not.toHaveBeenCalled()
    })

    it('falha ao enfileirar responde 200 e preserva a invalidação', async () => {
      const { invalidate, execute } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        failingEffects('enqueueProvisioning'),
      ).perform(
        reqWith(
          formBody({
            event: `ONCRMDYNAMICITEMADD_${SPA.subscriptionItemEntityType}`,
            id: '77',
          }),
        ),
      )

      expect(response.status).toBe(200)
      expect(execute).toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalled()
    })

    it('token inválido não invalida nem enfileira', async () => {
      const { invalidate, execute } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        effects,
      ).perform(
        reqWith(
          formBody({
            event: `ONCRMDYNAMICITEMADD_${SPA.subscriptionItemEntityType}`,
            id: '77',
            token: 'token_errado_mesmo_tamanho_aqui',
          }),
        ),
      )

      expect(response.status).toBe(401)
      expect(execute).not.toHaveBeenCalled()
      expect(enqueue).not.toHaveBeenCalled()
    })
  })

  describe('despacho da limpeza e da sincronização de status', () => {
    const itemEvent = (verb: string, id?: string) =>
      reqWith(
        formBody({
          event: `ONCRMDYNAMICITEM${verb}_${SPA.subscriptionItemEntityType}`,
          ...(id !== undefined && { id }),
        }),
      )

    it('exclusão de item enfileira a limpeza, depois de invalidar', async () => {
      const { invalidate, execute } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        effects,
      ).perform(itemEvent('DELETE', '77'))

      expect(response.status).toBe(200)
      expect(enqueueCleanup).toHaveBeenCalledWith({
        itemId: '77',
        traceKey: 'spa-item-77',
      })
      expect(enqueueStatusSync).not.toHaveBeenCalled()
      expect(enqueue).not.toHaveBeenCalled()
      expect(execute.mock.invocationCallOrder[0]!).toBeLessThan(
        enqueueCleanup.mock.invocationCallOrder[0]!,
      )
    })

    it('atualização de item enfileira a sincronização de status', async () => {
      const { invalidate, execute } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        effects,
      ).perform(itemEvent('UPDATE', '77'))

      expect(response.status).toBe(200)
      expect(enqueueStatusSync).toHaveBeenCalledWith({
        itemId: '77',
        traceKey: 'spa-item-77',
      })
      expect(enqueueCleanup).not.toHaveBeenCalled()
      expect(execute.mock.invocationCallOrder[0]!).toBeLessThan(
        enqueueStatusSync.mock.invocationCallOrder[0]!,
      )
    })

    it('exclusão sem sufixo de SPA também enfileira a limpeza', async () => {
      const { invalidate } = makeInvalidate()

      await new SpaWebhookController(invalidate, TOKEN, effects).perform(
        reqWith(
          formBody({
            event: 'ONCRMDYNAMICITEMDELETE',
            entityTypeId: String(SPA.subscriptionItemEntityType),
            id: '25',
          }),
        ),
      )

      expect(enqueueCleanup).toHaveBeenCalledWith({
        itemId: '25',
        traceKey: 'spa-item-25',
      })
    })

    it('exclusão sem id registra warn e não enfileira', async () => {
      const { invalidate } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        effects,
      ).perform(itemEvent('DELETE'))

      expect(response.status).toBe(200)
      expect(enqueueCleanup).not.toHaveBeenCalled()
      expect(apiLogger.warn).toHaveBeenCalled()
    })

    it('exclusão nas outras SPAs de billing não enfileira efeito de recurso', async () => {
      const others = [
        SPA.subscriptionEntityType,
        SPA.planEntityType,
        SPA.productEntityType,
        SPA.aplicationEntityType,
      ]

      for (const entityTypeId of others) {
        const { invalidate } = makeInvalidate()

        await new SpaWebhookController(invalidate, TOKEN, effects).perform(
          reqWith(
            formBody({
              event: `ONCRMDYNAMICITEMDELETE_${entityTypeId}`,
              id: '5',
            }),
          ),
        )

        expect(enqueueCleanup).not.toHaveBeenCalled()
        expect(enqueueStatusSync).not.toHaveBeenCalled()
        vi.clearAllMocks()
      }
    })

    /**
     * Cancelar recurso por inferência é destrutivo e irreversível para o cliente — e o
     * verbo é o único sinal que distingue update de delete.
     */
    it('verbo desconhecido não enfileira limpeza nem sincronização', async () => {
      const { invalidate, execute } = makeInvalidate()

      await new SpaWebhookController(invalidate, TOKEN, effects).perform(
        reqWith(
          formBody({
            entityTypeId: String(SPA.subscriptionItemEntityType),
            id: '77',
          }),
        ),
      )

      expect(execute).toHaveBeenCalled()
      expect(enqueueCleanup).not.toHaveBeenCalled()
      expect(enqueueStatusSync).not.toHaveBeenCalled()
    })

    it('falha ao enfileirar a limpeza responde 200 com error', async () => {
      const { invalidate, execute } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        failingEffects('enqueueCleanup'),
      ).perform(itemEvent('DELETE', '77'))

      expect(response.status).toBe(200)
      expect(execute).toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalled()
    })

    it('falha ao enfileirar a sincronização responde 200 com error', async () => {
      const { invalidate } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        failingEffects('enqueueStatusSync'),
      ).perform(itemEvent('UPDATE', '77'))

      expect(response.status).toBe(200)
      expect(apiLogger.error).toHaveBeenCalled()
    })
  })

  describe('desvínculo do espelho da instalação (1060)', () => {
    const aplicationEvent = (verb: string, id?: string) =>
      reqWith(
        formBody({
          event: `ONCRMDYNAMICITEM${verb}_${SPA.aplicationEntityType}`,
          ...(id !== undefined && { id }),
        }),
      )

    it('exclusão desvincula, depois de invalidar', async () => {
      const { invalidate, execute } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        effects,
      ).perform(aplicationEvent('DELETE', '7'))

      expect(response.status).toBe(200)
      expect(unlinkAplicationSpaItem).toHaveBeenCalledWith('7')
      expect(execute.mock.invocationCallOrder[0]!).toBeLessThan(
        unlinkAplicationSpaItem.mock.invocationCallOrder[0]!,
      )
    })

    it('atualização não desvincula — editar o espelho não é apagá-lo', async () => {
      const { invalidate, execute } = makeInvalidate()

      await new SpaWebhookController(invalidate, TOKEN, effects).perform(
        aplicationEvent('UPDATE', '7'),
      )

      expect(execute).toHaveBeenCalled()
      expect(unlinkAplicationSpaItem).not.toHaveBeenCalled()
    })

    it('exclusão sem id registra warn e não desvincula', async () => {
      const { invalidate } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        effects,
      ).perform(aplicationEvent('DELETE'))

      expect(response.status).toBe(200)
      expect(unlinkAplicationSpaItem).not.toHaveBeenCalled()
      expect(apiLogger.warn).toHaveBeenCalled()
    })

    it('exclusão nas outras SPAs não desvincula', async () => {
      for (const entityTypeId of [
        SPA.subscriptionEntityType,
        SPA.subscriptionItemEntityType,
        SPA.planEntityType,
      ]) {
        const { invalidate } = makeInvalidate()

        await new SpaWebhookController(invalidate, TOKEN, effects).perform(
          reqWith(
            formBody({
              event: `ONCRMDYNAMICITEMDELETE_${entityTypeId}`,
              id: '5',
            }),
          ),
        )

        expect(unlinkAplicationSpaItem).not.toHaveBeenCalled()
        vi.clearAllMocks()
      }
    })

    it('falha no desvínculo responde 200 com error', async () => {
      const { invalidate, execute } = makeInvalidate()

      const response = await new SpaWebhookController(
        invalidate,
        TOKEN,
        failingEffects('unlinkAplicationSpaItem', new Error('db down')),
      ).perform(aplicationEvent('DELETE', '7'))

      expect(response.status).toBe(200)
      expect(execute).toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalled()
    })
  })
})
