import { Request } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SpaWebhookController } from './spa-webhook.controller'
import { InvalidateSpaCache } from '@/modules/application/application/invalidate-spa-cache'
import { env } from '@/config/env'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const TOKEN = 'application_token_do_webhook'
const SPA = env.payments.spa

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

    const response = await new SpaWebhookController(invalidate, TOKEN).perform(
      reqWith(formBody({ event: 'ONCRMDYNAMICITEMUPDATE_1142', id: '42' })),
    )

    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionEntityType,
      itemId: '42',
    })
  })

  it('lê o corpo aninhado do formulário do Bitrix', async () => {
    const { invalidate, execute } = makeInvalidate()

    await new SpaWebhookController(invalidate, TOKEN).perform(
      reqWith({
        event: 'ONCRMDYNAMICITEMADD_1146',
        data: { FIELDS: { ID: '9', ENTITY_TYPE_ID: '1146' } },
        auth: { application_token: TOKEN, domain: 'x.bitrix24.com.br' },
      }),
    )

    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionItemEntityType,
      itemId: '9',
    })
  })

  it('aceita ID numérico e o normaliza para string', async () => {
    const { invalidate, execute } = makeInvalidate()

    await new SpaWebhookController(invalidate, TOKEN).perform(
      reqWith({
        event: 'ONCRMDYNAMICITEMUPDATE_1142',
        data: { FIELDS: { ID: 42 } },
        auth: { application_token: TOKEN },
      }),
    )

    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionEntityType,
      itemId: '42',
    })
  })

  it('trata add e delete como update', async () => {
    const { invalidate, execute } = makeInvalidate()
    const controller = new SpaWebhookController(invalidate, TOKEN)

    await controller.perform(
      reqWith(formBody({ event: 'ONCRMDYNAMICITEMDELETE_1146', id: '9' })),
    )

    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionItemEntityType,
      itemId: '9',
    })
  })

  it('cai para ENTITY_TYPE_ID quando o evento não traz o sufixo', async () => {
    const { invalidate, execute } = makeInvalidate()

    await new SpaWebhookController(invalidate, TOKEN).perform(
      reqWith(
        formBody({ event: 'ONCRMITEMUPDATE', id: '5', entityTypeId: '1138' }),
      ),
    )

    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.planEntityType,
      itemId: '5',
    })
  })

  it('responde 401 e não invalida nada quando o token diverge', async () => {
    const { invalidate, execute } = makeInvalidate()

    const response = await new SpaWebhookController(invalidate, TOKEN).perform(
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

    const response = await new SpaWebhookController(invalidate, TOKEN).perform(
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

    const response = await new SpaWebhookController(invalidate, '').perform(
      reqWith(formBody({ event: 'ONCRMDYNAMICITEMUPDATE_1142', id: '42' })),
    )

    expect(response.status).toBe(503)
    expect(execute).not.toHaveBeenCalled()
  })

  it('responde 200 sem invalidar quando o evento é irreconhecível', async () => {
    const { invalidate, execute } = makeInvalidate()

    const response = await new SpaWebhookController(invalidate, TOKEN).perform(
      reqWith(formBody({ event: 'ONAPPINSTALL' })),
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ handled: false })
    expect(execute).not.toHaveBeenCalled()
  })

  it('delega SPA fora do escopo de billing ao invalidador, que a ignora', async () => {
    const { invalidate, execute } = makeInvalidate()
    execute.mockResolvedValueOnce({ handled: false, deletedKeys: 0 })

    const response = await new SpaWebhookController(invalidate, TOKEN).perform(
      reqWith(formBody({ event: 'ONCRMDYNAMICITEMUPDATE_1050', id: '1' })),
    )

    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({ entityTypeId: 1050, itemId: '1' })
  })

  it('responde 200 quando o payload não traz id de item', async () => {
    const { invalidate, execute } = makeInvalidate()
    execute.mockResolvedValueOnce({ handled: true, deletedKeys: 0 })

    const response = await new SpaWebhookController(invalidate, TOKEN).perform(
      reqWith(formBody({ event: 'ONCRMDYNAMICITEMUPDATE_1142' })),
    )

    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({
      entityTypeId: SPA.subscriptionEntityType,
      itemId: undefined,
    })
  })

  it('responde 401 quando o corpo não casa com o schema', async () => {
    const { invalidate, execute } = makeInvalidate()

    const response = await new SpaWebhookController(invalidate, TOKEN).perform(
      reqWith('não é objeto'),
    )

    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })
})
