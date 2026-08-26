import express, { type Express } from 'express'
import {
  authMiddleware,
  authRoutes,
  thinkanaliseRoutes,
  importsheetRoutes,
  clicksignRoutes,
  thinkerszapRoutes,
  portalRoutes,
  aplicationRoutes,
  gptmakerRoutes,
} from './composition-root.js'
import { makeGoogleOAuthCallbackController } from './modules/importsheet/main/make-google-oauth-controllers.js'
import cors from 'cors'
import multer from 'multer'
import { makeZApiWebhookHandlerController } from './modules/thinkzap/main/z-api-webhook-handle-controller.js'
import { startCredentialRefreshJob } from './shared/infra/scheduler/credential-refresh.job.js'
import { adaptControllerFactory } from './shared/main/adapt-controller.js'
import {
  makeSendEnvelopeController,
  makeCancelDocumentController,
  makeClicksignWebhookController,
} from './modules/clicksign/main/make-clicksign-controllers.js'
import { makeBitrixWebhookHandlerController } from './modules/thinkzap/main/bitrix-webhook-handle-controller.js'
import { makeUploadAudioController } from './modules/audio/main/make-upload-audio-controller.js'
import { makeCheckController } from './modules/thinkanalise/main/callbacks/make-check-controller.js'
import { makeContaAzulOAuthCallbackController } from './modules/thinkanalise/main/make-conta-azul-oauth-controllers.js'
import { makeTablesController } from './modules/thinkanalise/main/callbacks/make-tables-controller.js'
import { makeDescribeController } from './modules/thinkanalise/main/callbacks/make-describe-controller.js'
import { makeDataController } from './modules/thinkanalise/main/callbacks/make-data-controller.js'
import { makeBitrixRobotWebhookHandlerController } from './modules/thinkzap/main/make-bitrix-robot-webhook-controller.js'
import { makeBitrixTemplateRobotWebhookHandlerController } from './modules/thinkzap/main/make-bitrix-template-robot-webhook-controller.js'
import {
  bullBoardAuthMiddleware,
  bullBoardRouter,
  isBullBoardEnabled,
} from './queue/bull-board.js'
import { apiLogger, resolveLogApp } from './shared/infra/logger.js'
import { runWithLogContext } from './shared/infra/log-context.js'
import { randomUUID } from 'node:crypto'
import { makeHubmessageWebhookHandlerController } from './modules/thinkzap/main/make-hubmessage-webhook-handler-controller.js'
import { makeStripeWebhookController } from './modules/thinkzap/main/subscription/make-subscription-controllers.js'
import { makeSpaWebhookController } from './modules/application/main/make-spa-webhook-controller.js'
import {
  buildMcpOAuthRouter,
  isMcpOAuthConfigured,
  mcpLoginHandler,
} from './modules/mcp-oauth/main/mcp-oauth.router.js'

const app: Express = express()

// Store de contexto por request; controllers/middlewares enriquecem com o tenant
// (domain/appId) via setLogContext e o logger injeta em toda linha.
app.use((_req, _res, next) =>
  runWithLogContext({ traceKey: randomUUID() }, next),
)

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
// Webhook Clicksign ANTES do express.json() — raw body p/ validar HMAC.
app.post(
  '/api/clicksign/webhook/:appId/:ref',
  express.raw({ type: '*/*' }),
  adaptControllerFactory(makeClicksignWebhookController),
)

/**
 * Webhook do Stripe, também ANTES do express.json().
 *
 * A validação da assinatura do evento é um HMAC sobre os bytes exatos que
 * chegaram. Registrada depois do parser, o corpo já foi reserializado e a
 * assinatura falha em **100%** dos eventos — o que aparece como "segredo errado" e
 * manda procurar no lugar errado. A ordem aqui é a correção, não uma preferência.
 */
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: '*/*' }),
  adaptControllerFactory(makeStripeWebhookController),
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
  '/api/webhooks/hubmessage',
  adaptControllerFactory(makeHubmessageWebhookHandlerController),
)
app.post(
  '/api/thinkzap/webhooks/bitrix/robot',
  adaptControllerFactory(makeBitrixRobotWebhookHandlerController),
)
/**
 * Robô de envio de **template**. Rota própria e não uma variante da de cima: o
 * `HANDLER` do robô é o que identifica o disparo no Bitrix, e os dois robôs precisam
 * de handlers distintos para coexistirem no mesmo portal.
 *
 * Tem de bater com `BITRIX_TEMPLATE_ROBOT_HANDLER_URL` — é essa URL que vai no
 * registro do robô, e um descasamento só aparece no primeiro disparo, como `404`.
 */
app.post(
  '/api/thinkzap/webhooks/bitrix/template-robot',
  adaptControllerFactory(makeBitrixTemplateRobotWebhookHandlerController),
)

/**
 * Webhook de saída das SPAs de billing do portal interno — invalida o cache Redis
 * do módulo `payments` quando um item é editado à mão no CRM.
 *
 * Registrado **depois** do `express.urlencoded({ extended: true })`, ao contrário do
 * Stripe e do Clicksign: o Bitrix manda formulário com chaves aninhadas
 * (`data[FIELDS][ID]`), e é o parser que as transforma em objeto. Não há HMAC sobre
 * o corpo cru a preservar aqui — a autenticação é o `application_token` do payload.
 */
app.all('/api/webhooks/spa', adaptControllerFactory(makeSpaWebhookController))

// Clicksign — rotas públicas (POST do robô + event do Bitrix), SEM authMiddleware.
app.post(
  '/api/clicksign/bitrix/enviar-documento',
  adaptControllerFactory(makeSendEnvelopeController),
)
app.post(
  '/api/clicksign/bitrix/cancelar-documento',
  adaptControllerFactory(makeCancelDocumentController),
)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Authorization Server OAuth 2.1 do MCP de suporte. Na RAIZ (não sob /api): o
// claude.ai descobre /.well-known/* e chama /authorize, /token, /register, /revoke
// direto na origin do issuer. Só monta se as envs (segredo + URLs) existirem.
if (isMcpOAuthConfigured()) {
  app.use(buildMcpOAuthRouter())
  app.post('/mcp-oauth/login', mcpLoginHandler)
} else {
  apiLogger.warn('MCP OAuth desabilitado: MCP_JWT_SECRET/URLs não configurados')
}

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
app.use('/api/gptmaker', authMiddleware, gptmakerRoutes)

// Transversal, não por app: qualquer instalação com JWT válido consulta o próprio
// contexto de billing aqui. Quem é a instalação sai do token, não do prefixo.
app.use('/api/application', authMiddleware, aplicationRoutes)

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
