import express, { type Express } from 'express'
import {
  authMiddleware,
  authRoutes,
  thinkanaliseRoutes,
  importsheetRoutes,
  clicksignRoutes,
  thinkerszapRoutes,
  portalRoutes,
} from './composition-root.js'
import { makeGoogleOAuthCallbackController } from './modules/importsheet/main/make-google-oauth-controllers.js'
import cors from 'cors'
import multer from 'multer'
import { makeStripeWebhookHandlerController } from './modules/thinkzap/main/stripe-webhook.handler.js'
import { makeZApiWebhookHandlerController } from './modules/thinkzap/main/z-api-webhook-handle-controller.js'
import { startCredentialRefreshJob } from './shared/infra/scheduler/credential-refresh.job.js'
import { adaptControllerFactory } from './shared/main/adapt-controller.js'
import { makeBitrixWebhookHandlerController } from './modules/thinkzap/main/bitrix-webhook-handle-controller.js'
import { makeUploadAudioController } from './modules/audio/main/make-upload-audio-controller.js'
import { makeCheckController } from './modules/thinkanalise/main/callbacks/make-check-controller.js'
import { makeContaAzulOAuthCallbackController } from './modules/thinkanalise/main/make-conta-azul-oauth-controllers.js'
import { makeTablesController } from './modules/thinkanalise/main/callbacks/make-tables-controller.js'
import { makeDescribeController } from './modules/thinkanalise/main/callbacks/make-describe-controller.js'
import { makeDataController } from './modules/thinkanalise/main/callbacks/make-data-controller.js'
import { makeBitrixRobotWebhookHandlerController } from './modules/thinkzap/main/make-bitrix-robot-webhook-controller.js'
import {
  bullBoardAuthMiddleware,
  bullBoardRouter,
  isBullBoardEnabled,
} from './queue/bull-board.js'
import { apiLogger, resolveLogApp } from './shared/infra/logger.js'

const app: Express = express()

app.use((req, res, next) => {
  const startedAt = Date.now()

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt

    apiLogger.info(
      {
        app: resolveLogApp(req.originalUrl),
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      },
      'HTTP request completed',
    )
  })

  next()
})

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

// JSON parser para as demais rotas (incluindo z-api webhook).
// O widget envia anexos em base64 e pode ultrapassar o limite default do Express (~100kb).
app.use(express.json({ limit: '30mb' }))
app.use(express.urlencoded({ extended: true, limit: '30mb' }))
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

if (isBullBoardEnabled) {
  app.use('/api/admin/queues', bullBoardAuthMiddleware, bullBoardRouter)
}

app.use('/api/auth', authRoutes)
app.use('/api/portal', portalRoutes)

// Callback público do OAuth Conta Azul (sem auth — redirect do browser vindo da Conta Azul)
app.get(
  '/api/thinkanalise/oauth/conta-azul/callback',
  adaptControllerFactory(makeContaAzulOAuthCallbackController),
)

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

// Callback público do OAuth Google (sem auth — redirect do browser vindo do Google)
app.get(
  '/api/importsheet/oauth/google/callback',
  adaptControllerFactory(makeGoogleOAuthCallbackController),
)

// Rotas por aplicação (com auth)
app.use('/api/thinkzap', authMiddleware, thinkerszapRoutes)
app.use('/api/thinkanalise', authMiddleware, thinkanaliseRoutes)
app.use('/api/importsheet', authMiddleware, importsheetRoutes)
app.use('/api/clicksign', authMiddleware, clicksignRoutes)

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

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          result: { error: 'File too large (max 30 MB per file)' },
        })
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({
          result: { error: 'Too many files (max 10 per request)' },
        })
      }

      return res.status(400).json({
        result: { error: `Upload error: ${err.message}` },
      })
    }

    return next(err)
  },
)

export { app }
