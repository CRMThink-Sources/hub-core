import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { AddDatasetController } from '../presentation/controllers/add-dataset.controller'
import { ListDatasetsController } from '../presentation/controllers/list-datasets.controller'
import { UpdateDatasetController } from '../presentation/controllers/update-dataset.controller'
import { SyncDatasetFieldsController } from '../presentation/controllers/sync-dataset-fields.controller'
import { DeleteDatasetController } from '../presentation/controllers/delete-dataset.controller'

async function getBitrix(req: Request): Promise<BitrixBiConnectorClient> {
  return (await makeBitrixClient(req, 'biconnector')) as BitrixBiConnectorClient
}

export const makeAddDatasetController = async (
  req: Request,
): Promise<Controller> => new AddDatasetController(await getBitrix(req))

export const makeListDatasetsController = async (
  req: Request,
): Promise<Controller> => new ListDatasetsController(await getBitrix(req))

export const makeUpdateDatasetController = async (
  req: Request,
): Promise<Controller> => new UpdateDatasetController(await getBitrix(req))

export const makeSyncDatasetFieldsController = async (
  req: Request,
): Promise<Controller> => new SyncDatasetFieldsController(await getBitrix(req))

export const makeDeleteDatasetController = async (
  req: Request,
): Promise<Controller> => new DeleteDatasetController(await getBitrix(req))
