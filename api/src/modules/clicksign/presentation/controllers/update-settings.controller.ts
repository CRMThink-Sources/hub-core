import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  ClickSignSettings,
  ClickSignSettingsRepository,
} from '../../domain/repositories/clicksign-settings.repository'
import { buildClicksignRobotUpdateParams } from '../../application/build-robot-params'
import {
  ProvisionableToken,
  WebhookProvisioningService,
} from '../../application/webhook-provisioning.service'
import { settingsPatchSchema } from './settings-payload.schema'
import { safeErrorMessage } from '../../infra/clients/clicksign-error'
import { clicksignError, logClicksignError } from '../../errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

export class UpdateSettingsController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly settings: ClickSignSettingsRepository,
    private readonly bitrix: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appCodeId = req.appId as string
    const domainId = req.domainId as string

    const parsed = settingsPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues[0]?.message ?? 'Body inválido'),
      )
    }

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appCodeId,
      domainId,
    )
    if (!app) throw clicksignError('clicksign.settings.app_not_found')

    // Lê o estado anterior antes do upsert: o front salva tokens sem o campo
    // `webhook` e o upsert sobrescreve o fields inteiro, então recuperamos o
    // webhook já registrado (casado por token) para não re-registrar a cada save.
    const previous = await this.settings.findByAppId(app.id)

    let settings = await this.settings.upsertByAppId(app.id, parsed.data)

    // Best-effort: falha aqui não invalida o save das settings.
    await this.syncRobotOptions(settings)

    settings = await this.syncWebhooks(app.id, settings, previous)

    const tokensCount = Array.isArray(
      (settings.fields as { tokens?: unknown[] } | null)?.tokens,
    )
      ? (settings.fields as { tokens: unknown[] }).tokens.length
      : 0
    apiLogger.info(
      {
        app: 'clicksign',
        appId: app.id,
        tokens: tokensCount,
        groups: Array.isArray(settings.groups) ? settings.groups.length : 0,
      },
      'Configurações salvas',
    )

    return this.ok({ settings })
  }

  private async syncWebhooks(
    appId: string,
    settings: ClickSignSettings,
    previous: ClickSignSettings | null,
  ): Promise<ClickSignSettings> {
    try {
      const fields = settings.fields as {
        tokens?: ProvisionableToken[]
        [key: string]: unknown
      } | null
      const tokens = Array.isArray(fields?.tokens) ? fields.tokens : []
      if (tokens.length === 0) return settings

      // Recupera o webhook já registrado (perdido no upsert) casando por token.
      const prevByToken = webhookByToken(previous)
      const merged = tokens.map(t =>
        t.webhook ? t : { ...t, webhook: prevByToken.get(t.token) },
      )

      const result = await new WebhookProvisioningService(appId).sync(merged)

      if (result.changed) {
        apiLogger.info(
          { app: 'clicksign', appId, tokens: result.tokens.length },
          'Webhooks sincronizados na Clicksign',
        )
      }

      // Sempre re-persiste: o upsert derrubou o webhook, então mesmo em no-op
      // gravamos o webhook (mesclado ou recém-criado) de volta.
      return this.settings.upsertByAppId(appId, {
        fields: { ...fields, tokens: result.tokens },
      })
    } catch (error) {
      logClicksignError(
        apiLogger,
        'clicksign.settings.webhook_sync_failed',
        { appId, err: safeErrorMessage(error) },
        { level: 'error' },
      )
      return settings
    }
  }

  private async syncRobotOptions(settings: ClickSignSettings): Promise<void> {
    try {
      const groups = Array.isArray(settings.groups)
        ? (settings.groups as Array<{ id?: string }>)
        : []
      const groupOptions: Record<string, string> = {}
      for (const group of groups) {
        if (typeof group?.id === 'string') {
          groupOptions[group.id.replaceAll(' ', '')] = group.id
        }
      }

      const fields = settings.fields as { tokens?: unknown } | null
      const tokens = Array.isArray(fields?.tokens)
        ? (fields.tokens as Array<{ token?: string; name?: string }>)
        : []
      const empresaOptions: Record<string, string> = {}
      for (const entry of tokens) {
        if (typeof entry?.token === 'string') {
          empresaOptions[entry.token] = entry.name ?? entry.token
        }
      }

      await this.bitrix.callMethod(
        'bizproc.robot.update',
        buildClicksignRobotUpdateParams(groupOptions, empresaOptions),
      )
    } catch (error) {
      logClicksignError(
        apiLogger,
        'clicksign.settings.robot_update_failed',
        { err: safeErrorMessage(error) },
        { level: 'error' },
      )
    }
  }
}

function webhookByToken(
  previous: ClickSignSettings | null,
): Map<string, ProvisionableToken['webhook']> {
  const map = new Map<string, ProvisionableToken['webhook']>()
  const fields = previous?.fields as { tokens?: ProvisionableToken[] } | null
  for (const token of fields?.tokens ?? []) {
    if (token.webhook) map.set(token.token, token.webhook)
  }
  return map
}
