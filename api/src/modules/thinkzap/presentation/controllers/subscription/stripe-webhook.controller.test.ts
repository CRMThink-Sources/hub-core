import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Request } from 'express'
import { describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { StripeWebhookController } from './stripe-webhook.controller'
import { HandleGatewayWebhookEvent } from '@/modules/thinkzap/application/handle-gateway-webhook-event'
import {
  GatewayEvent,
  GatewaySignatureError,
  PaymentGateway,
} from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { StripePaymentGateway } from '@/modules/thinkzap/infra/gateway/stripe-payment.gateway'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const IGNORED: GatewayEvent = { type: 'ignored', name: 'invoice.paid' }

const makeGateway = (event: GatewayEvent | Error) => {
  const verifyWebhookEvent = vi.fn(() =>
    event instanceof Error ? Promise.reject(event) : Promise.resolve(event),
  )

  return {
    gateway: {
      verifyWebhookEvent,
      createCheckoutSession: vi.fn(),
      createBillingPortalSession: vi.fn(),
    } as unknown as PaymentGateway,
    verifyWebhookEvent,
  }
}

const makeHandler = () => {
  const execute = vi.fn(() => Promise.resolve())
  return {
    handler: { execute } as unknown as HandleGatewayWebhookEvent,
    execute,
  }
}

const reqWith = (body: unknown, signature?: string) =>
  ({
    body,
    header: (name: string) =>
      name === 'stripe-signature' ? signature : undefined,
  }) as unknown as Request

describe('StripeWebhookController', () => {
  it('processa o evento quando a assinatura confere', async () => {
    const { gateway, verifyWebhookEvent } = makeGateway(IGNORED)
    const { handler, execute } = makeHandler()
    const raw = Buffer.from('{"id":"evt_1"}')

    const response = await new StripeWebhookController(
      gateway,
      handler,
    ).perform(reqWith(raw, 't=1,v1=abc'))

    expect(verifyWebhookEvent).toHaveBeenCalledWith(raw, 't=1,v1=abc')
    expect(execute).toHaveBeenCalledWith(IGNORED)
    expect(response.status).toBe(200)
  })

  /** Assinatura inválida: erro na resposta, e **nada** processado. */
  it('recusa e não processa quando a assinatura não confere', async () => {
    const { gateway } = makeGateway(
      new GatewaySignatureError('no signatures found'),
    )
    const { handler, execute } = makeHandler()

    const response = await new StripeWebhookController(
      gateway,
      handler,
    ).perform(reqWith(Buffer.from('{}'), 'assinatura-errada'))

    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  /**
   * A regressão que o registro na ordem errada causa: depois do `express.json()` o
   * corpo chega como objeto, e o controller recusa em vez de remontar bytes que
   * ninguém assinou.
   */
  it('recusa corpo já parseado, sem chamar a validação', async () => {
    const { gateway, verifyWebhookEvent } = makeGateway(IGNORED)
    const { handler, execute } = makeHandler()

    const response = await new StripeWebhookController(
      gateway,
      handler,
    ).perform(
      reqWith(
        { id: 'evt_1', type: 'checkout.session.completed' },
        't=1,v1=abc',
      ),
    )

    expect(response.status).toBe(400)
    expect(verifyWebhookEvent).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('responde 200 para evento fora dos três tratados', async () => {
    const { gateway } = makeGateway(IGNORED)
    const { handler } = makeHandler()

    const response = await new StripeWebhookController(
      gateway,
      handler,
    ).perform(reqWith(Buffer.from('{}'), 't=1,v1=abc'))

    expect(response.status).toBe(200)
  })

  /** Erro que não é de assinatura sobe: o gateway deve reentregar. */
  it('propaga erro inesperado da validação', async () => {
    const { gateway } = makeGateway(new Error('rede fora'))
    const { handler } = makeHandler()

    await expect(
      new StripeWebhookController(gateway, handler).perform(
        reqWith(Buffer.from('{}'), 't=1,v1=abc'),
      ),
    ).rejects.toThrow('rede fora')
  })
})

/**
 * A prova de que a ordem de registro importa, contra a biblioteca real: o mesmo
 * payload assinado passa como `Buffer` e **falha** depois de um round-trip por
 * `JSON.parse`/`JSON.stringify` — que é exatamente o que o `express.json()` faz.
 *
 * Sem este teste, "registre antes do parser" é um comentário; com ele, é uma
 * afirmação verificada.
 */
describe('validação de assinatura sobre o corpo cru', () => {
  const SECRET = 'whsec_test_secret'
  const payload = JSON.stringify({
    id: 'evt_1',
    object: 'event',
    type: 'invoice.paid',
    data: { object: { id: 'in_1' } },
  })

  const sign = (body: string) =>
    Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET })

  it('aceita o corpo cru', async () => {
    const gateway = new StripePaymentGateway('sk_test_x', SECRET)

    await expect(
      gateway.verifyWebhookEvent(Buffer.from(payload), sign(payload)),
    ).resolves.toEqual({ type: 'ignored', name: 'invoice.paid' })
  })

  it('rejeita o mesmo evento depois de reserializado', async () => {
    const gateway = new StripePaymentGateway('sk_test_x', SECRET)
    const signature = sign(payload)

    // O que sobra de um `express.json()`: mesmo conteúdo, outros bytes.
    const reserialized = Buffer.from(
      JSON.stringify(JSON.parse(payload), null, 2),
    )

    await expect(
      gateway.verifyWebhookEvent(reserialized, signature),
    ).rejects.toBeInstanceOf(GatewaySignatureError)
  })

  it('rejeita quando o cabeçalho de assinatura não vem', async () => {
    const gateway = new StripePaymentGateway('sk_test_x', SECRET)

    await expect(
      gateway.verifyWebhookEvent(Buffer.from(payload), undefined),
    ).rejects.toBeInstanceOf(GatewaySignatureError)
  })

  /** Sem segredo não há como autenticar a origem: recusa, não passe livre. */
  it('rejeita quando o segredo de webhook não está configurado', async () => {
    const gateway = new StripePaymentGateway('sk_test_x', '')

    await expect(
      gateway.verifyWebhookEvent(Buffer.from(payload), sign(payload)),
    ).rejects.toBeInstanceOf(GatewaySignatureError)
  })
})

/**
 * A ordem de registro em `app.ts`, verificada sobre o texto: a rota do gateway tem
 * que aparecer **antes** da linha que instala o `express.json()`. É a única
 * verificação possível sem subir o app inteiro, e o custo de errar é 100% dos
 * eventos recusados.
 */
describe('app.ts (ordem de registro)', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', '..', '..', 'app.ts'),
    'utf8',
  )

  it('registra o webhook do gateway antes do express.json()', () => {
    const webhook = source.indexOf("'/api/webhooks/stripe'")
    // A instalação do parser, não a menção dele nos comentários acima.
    const jsonParser = source.indexOf('app.use(express.json(')

    expect(webhook).toBeGreaterThan(-1)
    expect(jsonParser).toBeGreaterThan(-1)
    expect(webhook).toBeLessThan(jsonParser)
  })

  it('recebe o corpo com express.raw', () => {
    expect(source).toMatch(/'\/api\/webhooks\/stripe',\s*\n\s*express\.raw\(/)
  })
})
