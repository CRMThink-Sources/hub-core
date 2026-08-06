import { Controller } from '@/shared/presentation/controller'
import { GetAplicationContextController } from '@/modules/application/presentation/controllers/get-aplication-context.controller'
import { makeGetAplicationContext } from './make-get-aplication-context'

/**
 * A montagem da árvore de repositórios vive em `makeGetAplicationContext`: as
 * rotas de linha do thinkzap precisam do mesmo caso de uso para resolver a
 * credencial Z-API a partir do item.
 */
export const makeGetAplicationContextController = (): Controller =>
  new GetAplicationContextController(makeGetAplicationContext())
