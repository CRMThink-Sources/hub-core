import { createAuthMiddleware } from './middleware/auth.js'
import { createThinkerszapRoutes } from './modules/thinkzap/routes.js'
import { createAuthRoutes } from './modules/auth/routes.js'

// Auth
export const authMiddleware = createAuthMiddleware()

// Routes (com dependências injetadas)
export const thinkerszapRoutes = createThinkerszapRoutes()

// Auth routes
export const authRoutes = createAuthRoutes()

// Export para uso em testes ou outros entrypoints
