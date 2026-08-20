import { createAuthMiddleware } from './middleware/auth.js'
import { createThinkerszapRoutes } from './modules/thinkzap/routes.js'
import { createAuthRoutes } from './modules/auth/routes.js'
import { createThinkAnaliseRoutes } from './modules/thinkanalise/routes.js'
import { createImportSheetRoutes } from './modules/importsheet/routes.js'
import { createClickSignRoutes } from './modules/clicksign/routes.js'
import { createPortalAuthMiddleware } from './modules/portal/infra/middleware/portal-auth.middleware.js'
import { createPortalRoutes } from './modules/portal/routes.js'
import { createAplicationRoutes } from './modules/application/routes.js'

// Auth
export const authMiddleware = createAuthMiddleware()
export const portalAuthMiddleware = createPortalAuthMiddleware()

// Routes (com dependências injetadas)
export const thinkerszapRoutes = createThinkerszapRoutes()

// Auth routes
export const authRoutes = createAuthRoutes()

// Portal routes
export const portalRoutes = createPortalRoutes(portalAuthMiddleware)

// Export para uso em testes ou outros entrypoints

export const thinkanaliseRoutes = createThinkAnaliseRoutes()

export const importsheetRoutes = createImportSheetRoutes()

export const clicksignRoutes = createClickSignRoutes()

// Contexto de billing da instalação atual, do módulo `payments`. Prefixo próprio
// (`/api/application`) porque o recurso é a instalação, e serve qualquer app.
export const aplicationRoutes = createAplicationRoutes()
