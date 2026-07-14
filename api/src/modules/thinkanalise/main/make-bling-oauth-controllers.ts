import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { blingOAuthStateStore } from '../infra/oauth-state.store'
import { BlingOAuthStartController } from '../presentation/controllers/bling-oauth-start.controller'
import { BlingOAuthCallbackController } from '../presentation/controllers/bling-oauth-callback.controller'

export const makeBlingOAuthStartController = (_req: Request): Controller =>
  new BlingOAuthStartController(blingOAuthStateStore)

export const makeBlingOAuthCallbackController = (_req: Request): Controller =>
  new BlingOAuthCallbackController(blingOAuthStateStore)
