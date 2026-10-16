import { makeSyncLineConnectedField } from '@/modules/thinkzap/main/make-sync-line-connected-field'
import { Request } from 'express'
import { env } from '@/config/env'
import { ensureSubscriptionItemDeletionFields } from '@/modules/application/infra/bitrix/ensure-subscription-item-deletion-fields'
import { enqueueSpaItemCleanupJob } from '@/queue/spa-item-resource-sync.queue'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { HubMessageConnectorProvider } from '@/modules/thinkzap/infra/providers/hubmessage-connector-provider'
import { ConnectOfficialLine } from '@/modules/thinkzap/application/connect-official-line'
import { GetLineConnection } from '@/modules/thinkzap/application/get-line-connection'
import { GetLineSettings } from '@/modules/thinkzap/application/get-line-settings'
import { UpdateLineSettings } from '@/modules/thinkzap/application/update-line-settings'
import { ReleaseDailyLimitExtra } from '@/modules/thinkzap/application/release-daily-limit-extra'
import { ReleaseDailyLimitExtraController } from '@/modules/thinkzap/presentation/controllers/line/release-daily-limit-extra.controller'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { RenameLineOnProviderUseCase } from '@/modules/thinkzap/application/rename-line-on-provider.use-case'
import { ZApiInstanceGateway } from '@/modules/thinkzap/infra/persistence/gateway/instance.gateway'
import { ConnectLineChannelController } from '@/modules/thinkzap/presentation/controllers/line/connect-line-channel.controller'
import { GetLineConnectionController } from '@/modules/thinkzap/presentation/controllers/line/get-line-connection.controller'
import { GetLineQrCodeController } from '@/modules/thinkzap/presentation/controllers/line/get-line-qr-code.controller'
import { DeleteLine } from '@/modules/thinkzap/application/delete-line'
import { BitrixGetUserDisplayNameAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'
import { DeleteLineController } from '@/modules/thinkzap/presentation/controllers/line/delete-line.controller'
import { DisconnectLineController } from '@/modules/thinkzap/presentation/controllers/line/disconnect-line.controller'
import { GetLineSettingsController } from '@/modules/thinkzap/presentation/controllers/line/get-line-settings.controller'
import { UpdateLineSettingsController } from '@/modules/thinkzap/presentation/controllers/line/update-line-settings.controller'
import { LinkLineChannelController } from '@/modules/thinkzap/presentation/controllers/line/link-line-channel.controller'
import { UnlinkLineChannelController } from '@/modules/thinkzap/presentation/controllers/line/unlink-line-channel.controller'
import {
  DeleteLineSmsProviderController,
  GetLineSmsProviderController,
  RegisterLineSmsProviderController,
} from '@/modules/thinkzap/presentation/controllers/line/line-sms-provider.controller'
import {
  DeleteTemplateSmsProviderController,
  GetLineTemplateProvidersController,
  RegisterTemplateSmsProviderController,
} from '@/modules/thinkzap/presentation/controllers/line/line-template-providers.controller'
import { ListWidgetTemplatesUseCase } from '@/modules/thinkzap/application/list-widget-templates'
import { makeTemplateProviderResolver } from '../connector/make-template-provider-resolver'
import { makeLineDeps } from './make-line-deps'
import { makeDisconnectExpiredLine } from '../make-disconnect-expired-line'

export const makeGetLineConnectionController = (): Controller => {
  const { getAplicationContext, hubMessageClient, zApiClient } = makeLineDeps()

  return new GetLineConnectionController(
    new GetLineConnection(
      getAplicationContext,
      zApiClient,
      makeDisconnectExpiredLine(),
      /**
       * O adapter entra só pelo `getConnectionStatus`. `webhookUrl` é do
       * provisionamento e não participa da leitura, mas o adapter é um só — dividi-lo
       * por consumidor faria a derivação de "canal conectado" existir em dois lugares.
       */
      new HubMessageConnectorProvider(hubMessageClient, {
        webhookUrl: env.hubMessage.webhookUrl,
      }),
    ),
  )
}

/**
 * Conexão do WhatsApp Oficial pela linha. Sem `PrismaConnectorRepository` nem
 * `PrismaInstanceRepository`: o canal sai do `metadata` do item, e a WABA volta
 * para lá.
 */
export const makeConnectLineChannelController = (): Controller => {
  const { getAplicationContext, hubMessageClient, subscriptionItems } =
    makeLineDeps()

  return new ConnectLineChannelController(
    new ConnectOfficialLine(
      getAplicationContext,
      hubMessageClient,
      subscriptionItems,
      makeSyncLineConnectedField(),
    ),
  )
}

export const makeGetLineQrCodeController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeLineDeps()

  return new GetLineQrCodeController(getAplicationContext, zApiClient)
}

export const makeDisconnectLineController = (): Controller => {
  const { getAplicationContext, instanceRepository, zApiClient } =
    makeLineDeps()

  return new DisconnectLineController(
    getAplicationContext,
    instanceRepository,
    zApiClient,
  )
}

/**
 * Cliente Bitrix **do portal do cliente** (`makeBitrixClient` resolve pela
 * credencial da instalação), para resolver o nome de quem excluiu via `user.get`
 * — diferente do cliente interno que `subscriptionItems` usa para escrever na
 * SPA (CRMThink). Mesmo par de portais de `makeLinkLineChannelController`.
 */
export const makeDeleteLineController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext, subscriptionItems } = makeLineDeps()

  return new DeleteLineController(
    new DeleteLine(
      getAplicationContext,
      subscriptionItems,
      new BitrixGetUserDisplayNameAdapter(await makeBitrixClient(req)),
      new PrismaAllowedUserRepository(),
      /**
       * Cliente Bitrix **interno** (CRMThink) — o mesmo portal onde a SPA 1146
       * vive, não o do cliente. `makeSubscriptionItemRepository` monta um
       * equivalente para escrever no item; este é só para o guard ler os campos.
       */
      () =>
        ensureSubscriptionItemDeletionFields(
          new BitrixClient({ webhook: env.crmthinkWebhookUrl }),
        ),
      enqueueSpaItemCleanupJob,
    ),
  )
}

export const makeGetLineSettingsController = (): Controller => {
  const { getAplicationContext } = makeLineDeps()

  return new GetLineSettingsController(
    new GetLineSettings(getAplicationContext, makeDailySendQuota()),
  )
}

export const makeReleaseDailyLimitExtraController = (): Controller => {
  const { getAplicationContext } = makeLineDeps()

  return new ReleaseDailyLimitExtraController(
    new ReleaseDailyLimitExtra(getAplicationContext, makeDailySendQuota()),
  )
}

export const makeUpdateLineSettingsController = (): Controller => {
  const { getAplicationContext, subscriptionItems, zApiClient } = makeLineDeps()

  const updateLineSettings = new UpdateLineSettings(
    new RenameLineOnProviderUseCase(new ZApiInstanceGateway(zApiClient)),
    subscriptionItems,
  )

  return new UpdateLineSettingsController(
    getAplicationContext,
    updateLineSettings,
  )
}

/**
 * Canal aberto usa o cliente Bitrix **do portal do cliente** (`makeBitrixClient`
 * resolve pela credencial da instalação), não o interno da CRMThink: o canal a
 * ativar vive no CRM do cliente.
 */
export const makeLinkLineChannelController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext, subscriptionItems, instanceRepository } =
    makeLineDeps()

  return new LinkLineChannelController(
    getAplicationContext,
    subscriptionItems,
    instanceRepository,
    await makeBitrixClient(req),
  )
}

export const makeUnlinkLineChannelController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext, subscriptionItems, instanceRepository } =
    makeLineDeps()

  return new UnlinkLineChannelController(
    getAplicationContext,
    subscriptionItems,
    instanceRepository,
    await makeBitrixClient(req),
  )
}

/**
 * Provedor de mensagem da campanha de SMS, na superficie do cliente.
 *
 * Cliente Bitrix **do portal do cliente**, como o vinculo de canal: o provedor a
 * registrar vive no CRM dele, e e la que a campanha vai procura-lo.
 */
export const makeGetLineSmsProviderController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext } = makeLineDeps()

  return new GetLineSmsProviderController(
    getAplicationContext,
    await makeBitrixClient(req),
  )
}

export const makeRegisterLineSmsProviderController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext } = makeLineDeps()

  return new RegisterLineSmsProviderController(
    getAplicationContext,
    await makeBitrixClient(req),
  )
}

export const makeDeleteLineSmsProviderController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext } = makeLineDeps()

  return new DeleteLineSmsProviderController(
    getAplicationContext,
    await makeBitrixClient(req),
  )
}

/**
 * Provedor por **template** da linha oficial.
 *
 * A listagem de templates entra como dependencia porque as tres rotas precisam do
 * catalogo aprovado: e ele que diz quais templates existem, quantas variaveis cada um
 * consome e se o que o cliente pediu para registrar ainda esta la.
 */
const makeTemplateCatalog = () =>
  new ListWidgetTemplatesUseCase(
    makeGetAplicationContext(),
    makeTemplateProviderResolver(),
  )

export const makeGetLineTemplateProvidersController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext } = makeLineDeps()

  return new GetLineTemplateProvidersController(
    getAplicationContext,
    makeTemplateCatalog(),
    await makeBitrixClient(req),
  )
}

export const makeRegisterTemplateSmsProviderController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext } = makeLineDeps()

  return new RegisterTemplateSmsProviderController(
    getAplicationContext,
    makeTemplateCatalog(),
    await makeBitrixClient(req),
  )
}

export const makeDeleteTemplateSmsProviderController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext } = makeLineDeps()

  return new DeleteTemplateSmsProviderController(
    getAplicationContext,
    await makeBitrixClient(req),
  )
}
