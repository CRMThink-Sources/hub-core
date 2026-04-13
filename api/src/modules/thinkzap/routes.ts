import { Router } from 'express'
import { makeCreateConnectorController } from './main/create-connector-controller'
import { makeListConnectorsController } from './main/list-connectors-controller'
import { makeGetQrCodeController } from './main/get-qr-code-controller'
import { makeVinculateChannelController } from './main/connector/make-vinculate-channel'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { makeListOpenChannelsController } from './main/make-list-open-channels-controller'
import { makeZApiWebhookHandlerController } from './main/z-api-webhook-handle-controller'

export const createThinkerszapRoutes = (): Router => {
  const router = Router()

  router.post(
    '/connector/create',
    adaptControllerFactory(makeCreateConnectorController),
  )
  router.get(
    '/connector/list',
    adaptControllerFactory(makeListConnectorsController),
  )
  router.get(
    '/connector/:id/qr-code',
    adaptControllerFactory(makeGetQrCodeController),
  )

  router.post(
    '/connector/vinculate-channel',
    adaptControllerFactory(makeVinculateChannelController),
  )

  router.get(
    '/openchannels',
    adaptControllerFactory(makeListOpenChannelsController),
  )

  return router
}
