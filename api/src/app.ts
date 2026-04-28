import express, { type Express } from 'express'
import {
  authMiddleware,
  authRoutes,
  thinkanaliseRoutes,
  thinkerszapRoutes,
} from './composition-root.js'
import cors from 'cors'
import multer from 'multer'
import { makeStripeWebhookHandlerController } from './modules/thinkzap/main/stripe-webhook.handler.js'
import { makeZApiWebhookHandlerController } from './modules/thinkzap/main/z-api-webhook-handle-controller.js'
import { startCredentialRefreshJob } from './shared/infra/scheduler/credential-refresh.job.js'
import { adaptControllerFactory } from './shared/main/adapt-controller.js'
import { makeBitrixWebhookHandlerController } from './modules/thinkzap/main/bitrix-webhook-handle-controller.js'
import { makeUploadAudioController } from './modules/audio/main/make-upload-audio-controller.js'
import { makeCheckController } from './modules/thinkanalise/main/callbacks/make-check-controller.js'
import { makeTablesController } from './modules/thinkanalise/main/callbacks/make-tables-controller.js'
import { makeDescribeController } from './modules/thinkanalise/main/callbacks/make-describe-controller.js'
import { makeDataController } from './modules/thinkanalise/main/callbacks/make-data-controller.js'
import { makeBitrixRobotWebhookHandlerController } from './modules/thinkzap/main/make-bitrix-robot-webhook-controller.js'

const app: Express = express()

// Antes do cors: no preflight OPTIONS o cors encerra a resposta sem next() — o header tem que existir nessa resposta (PNA).
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  next()
})

// origin: true reflete o Origin da requisição. Com * o Chrome costuma bloquear PNA (página pública → localhost).
app.use(
  cors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    maxAge: 86_400,
  }),
)
// Webhook do Stripe ANTES do express.json() — precisa do body raw (Buffer) para validar assinatura
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  adaptControllerFactory(makeStripeWebhookHandlerController),
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
app.post(
  '/api/thinkzap/webhooks/bitrix/robot',
  adaptControllerFactory(makeBitrixRobotWebhookHandlerController),
)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)

// Callbacks públicos do Bitrix BI Builder (sem auth — chamados diretamente pelo Bitrix)
app.post('/api/thinkanalise/check', adaptControllerFactory(makeCheckController))
app.post(
  '/api/thinkanalise/tables',
  adaptControllerFactory(makeTablesController),
)
app.post(
  '/api/thinkanalise/describe',
  adaptControllerFactory(makeDescribeController),
)
app.post('/api/thinkanalise/data', adaptControllerFactory(makeDataController))

// Rotas por aplicação (com auth)
app.use('/api/thinkzap', authMiddleware, thinkerszapRoutes)
app.use('/api/thinkanalise', authMiddleware, thinkanaliseRoutes)

const audioUploadParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
})

app.post(
  '/api/audio/upload',
  audioUploadParser.single('audio'),
  adaptControllerFactory(makeUploadAudioController),
)

// Jobs
startCredentialRefreshJob()

export { app }
