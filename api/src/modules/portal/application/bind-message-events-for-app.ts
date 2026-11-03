import { prisma } from '@/config/prisma.js'
import { env } from '@/config/env'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { ensureEventBindings } from '@/shared/infra/clients/ensure-event-bindings'
import { ensureConnectorRegistration } from '@/modules/thinkzap/application/ensure-connector-registration'
import type { EnsureConnectorRegistrationResult } from '@/modules/thinkzap/application/ensure-connector-registration'
import { CONNECTOR_MESSAGE_SYNC_EVENTS } from '@/modules/thinkzap/install/connector-message-events'
import { thinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  PortalAppNotFoundError,
  ThinkzapNotInstalledError,
} from '../domain/errors/portal-domain.errors'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type BindMessageEventsForAppOutput = {
  /** Resultado do re-registro do conector, que religa a flag de edição. */
  connectorResult: EnsureConnectorRegistrationResult
}

export type BindMessageEventsDeps = {
  findApp: (appId: string) => Promise<{ appCodeId: string } | null>
  resolveClient: typeof resolveBitrixClientForApp
  ensureBindings: typeof ensureEventBindings
  ensureConnector: typeof ensureConnectorRegistration
  webhookUrl: () => string | undefined
  thinkzapCode: () => string
}

const defaultDeps: BindMessageEventsDeps = {
  findApp: appId =>
    prisma.app.findUnique({
      where: { id: appId },
      select: { appCodeId: true },
    }),
  resolveClient: resolveBitrixClientForApp,
  ensureBindings: ensureEventBindings,
  ensureConnector: ensureConnectorRegistration,
  webhookUrl: () => env.bitrix.webhookUrl,
  thinkzapCode: thinkzapAppCodeId,
}

/**
 * Religa, no portal de uma instalação, os eventos de edição e exclusão de mensagem
 * do operador — e reaplica o registro do conector.
 *
 * O re-registro faz parte da ação porque o bind de edição não basta: sem
 * `EDIT_INTERNAL_MESSAGES: 'Y'` o Bitrix não emite o evento, e um portal antigo só
 * recebe a flag por `imconnector.register`.
 *
 * **Idempotente:** `ensureEventBindings` lê o estado do portal antes de ligar, e o
 * registro do conector atualiza o que já existe.
 *
 * O ADD fica de fora de propósito: é o evento de recepção, presente em todo portal em
 * operação, e esta ação existe para corrigir os que ficaram sem os outros dois.
 */
export async function bindMessageEventsForApp(
  appId: string,
  deps: BindMessageEventsDeps = defaultDeps,
): Promise<BindMessageEventsForAppOutput> {
  const app = await deps.findApp(appId)
  if (!app) throw new PortalAppNotFoundError()
  if (app.appCodeId !== deps.thinkzapCode()) {
    throw new ThinkzapNotInstalledError()
  }

  const handler = deps.webhookUrl()
  if (!handler) throw thinkzapError('thinkzap.config.missing_env')

  const { client } = await deps.resolveClient(appId)

  await deps.ensureBindings(
    client,
    CONNECTOR_MESSAGE_SYNC_EVENTS.map(event => ({ event, handler })),
  )

  const connectorResult = await deps.ensureConnector(client)

  return { connectorResult }
}
