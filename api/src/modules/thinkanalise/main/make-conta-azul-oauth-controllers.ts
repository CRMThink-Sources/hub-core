import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { contaAzulOAuthStateStore } from '../infra/oauth-state.store'
import { ContaAzulOAuthStartController } from '../presentation/controllers/conta-azul-oauth-start.controller'
import { ContaAzulOAuthCallbackController } from '../presentation/controllers/conta-azul-oauth-callback.controller'

export const makeContaAzulOAuthStartController = (_req: Request): Controller =>
  new ContaAzulOAuthStartController(contaAzulOAuthStateStore)

export const makeContaAzulOAuthCallbackController = (
  _req: Request,
): Controller => new ContaAzulOAuthCallbackController(contaAzulOAuthStateStore)
