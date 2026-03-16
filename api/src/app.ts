import express, { type Express } from 'express'
import {
  authMiddleware,
  authRoutes,
  thinkerszapRoutes,
} from './composition-root.js'
import cors from 'cors'
import Stripe from 'stripe'
import { env } from './config/env.js'
import { makeStripeWebhookHandlerController } from './modules/thinkzap/main/stripe-webhook.handler.js'
import { makeZApiWebhookHandlerController } from './modules/thinkzap/main/z-api-webhook-handle-controller.js'
import { startCredentialRefreshJob } from './shared/infra/scheduler/credential-refresh.job.js'
import { adaptControllerFactory } from './shared/main/adapt-controller.js'
import { makeBitrixWebhookHandlerController } from './modules/thinkzap/main/bitrix-webhook-handle-controller.js'

const app: Express = express()
const stripe = new Stripe(env.stripe.secretKey)
app.use(cors())
// Webhook do Stripe ANTES do express.json() — precisa do body raw (Buffer) para validar assinatura
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  makeStripeWebhookHandlerController().handle,
)

// JSON parser para as demais rotas (incluindo z-api webhook)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.post(
  '/api/webhooks/z-api',
  adaptControllerFactory(makeZApiWebhookHandlerController),
)
app.post(
  '/api/webhooks/bitrix',
  adaptControllerFactory(makeBitrixWebhookHandlerController),
)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)

// Rotas por aplicação (com auth)
app.use('/api/thinkzap', authMiddleware, thinkerszapRoutes)

// Jobs
startCredentialRefreshJob()

export { app }
