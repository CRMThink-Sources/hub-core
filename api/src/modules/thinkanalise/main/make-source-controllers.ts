import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { AddSourceController } from '../presentation/controllers/add-source.controller'
import { ListSourcesController } from '../presentation/controllers/list-sources.controller'
import { UpdateSourceController } from '../presentation/controllers/update-source.controller'
import { DeleteSourceController } from '../presentation/controllers/delete-source.controller'

async function getBitrix(req: Request): Promise<BitrixBiConnectorClient> {
  return (await makeBitrixClient(req, 'biconnector')) as BitrixBiConnectorClient
}

export const makeAddSourceController = async (
  req: Request,
): Promise<Controller> => new AddSourceController(await getBitrix(req))

export const makeListSourcesController = async (
  req: Request,
): Promise<Controller> => new ListSourcesController(await getBitrix(req))

export const makeUpdateSourceController = async (
  req: Request,
): Promise<Controller> => new UpdateSourceController(await getBitrix(req))

export const makeDeleteSourceController = async (
  req: Request,
): Promise<Controller> => new DeleteSourceController(await getBitrix(req))
