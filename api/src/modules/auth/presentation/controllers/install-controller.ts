import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import { GetOrCreateDomain } from '@/shared/application/get-or-create-domain'
import { GetOrCreateInstalledApp } from '@/shared/application/get-or-create-installed-app'
import { GetOrCreateCredential } from '@/shared/application/get-or-create-credential'
import { bitrixInstallBindRegistry } from '@/shared/infra/setup-bitrix-install-binds'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import z from 'zod'

const IFRAME_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.865 9.865 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`
const IFRAME_ICON_BASE64 = Buffer.from(IFRAME_ICON_SVG).toString('base64')

const IFRAME_LANG = [
  {
    LANGUAGE_ID: 'de',
    TITLE: 'ThinkersZap',
    DESCRIPTION: 'ThinkersZap-Widget öffnen',
    COPYRIGHT: 'Hubthink',
  },
  {
    LANGUAGE_ID: 'en',
    TITLE: 'ThinkersZap',
    DESCRIPTION: 'Open ThinkersZap widget',
    COPYRIGHT: 'Hubthink',
  },
  {
    LANGUAGE_ID: 'pt',
    TITLE: 'ThinkersZap',
    DESCRIPTION: 'Abrir widget ThinkersZap',
    COPYRIGHT: 'Hubthink',
  },
] as const

function parseBitrixNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (value && typeof value === 'object' && 'result' in value) {
    const inner = (value as { result?: unknown }).result
    if (typeof inner === 'number' && Number.isFinite(inner)) {
      return inner
    }
  }
  return null
}

export class InstallController extends Controller {
  constructor(
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly getOrCreateDomain: GetOrCreateDomain,
    private readonly getOrCreateInstalledApp: GetOrCreateInstalledApp,
    private readonly getOrCreateCredential: GetOrCreateCredential,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = z
      .object({
        domain: z.string(),
        member_id: z.string(),
        app_code: z.string(),
        access_token: z.string(),
        refresh_token: z.string(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { domain, member_id, app_code, access_token, refresh_token } =
      params.data

    const availableApp =
      await this.getAvailableAppRepository.getAvailableApp(app_code)

    if (!availableApp) {
      return this.notFound(new Error('Available app not found'))
    }

    const domainEntity = await this.getOrCreateDomain.execute({
      name: domain,
      memberId: member_id,
    })

    const installedApp = await this.getOrCreateInstalledApp.execute({
      domainId: domainEntity.id,
      appCodeId: availableApp.id,
    })

    await this.getOrCreateCredential.execute({
      appId: installedApp.id,
      clientId: availableApp.code,
      clientSecret: availableApp.secret,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    })

    const bitrixClient = new BitrixRestClient(domain, access_token)
    const bitrixBinds = bitrixInstallBindRegistry.getBindsForApp(app_code)

    if (bitrixBinds.length > 0) {
      for (const bind of bitrixBinds) {
        try {
          await bitrixClient.callMethod(bind.method, bind.params)
        } catch (error: any) {
          console.error(
            `Error binding ${bind.method} to Bitrix:`,
            (error as Error).message,
          )
        }
      }
    }
    await this.registerThinkzapIframeApp(bitrixClient, app_code)

    return {
      result: {
        ...domainEntity,
        app: installedApp,
      },
      status: 200,
    }
  }

  private async registerThinkzapIframeApp(
    bitrixClient: BitrixRestClient,
    appCode: string,
  ) {
    if (appCode !== env.appCodes.thinkzap) {
      return
    }

    const botId = await this.getOrCreateThinkzapBot(bitrixClient)
    console.log({ botId, context: env.bitrix.chatIframeContext })
    if (!botId) {
      return
    }

    const iframeFields = this.buildIframeAppFields()

    try {
      if (env.bitrix.chatIframeAppId > 0) {
        await this.applyIframeAppUpdate(
          bitrixClient,
          env.bitrix.chatIframeAppId,
          iframeFields,
        )
        console.log(
          'imbot.app.update (por BITRIX_CHAT_IFRAME_APP_ID):',
          env.bitrix.chatIframeAppId,
        )
        return
      }

      const registerPayload = {
        BOT_ID: botId,
        CODE: env.bitrix.chatIframeCode,
        ...iframeFields,
      }
      console.log({ registerPayload })

      const registerRaw = await bitrixClient.callMethod(
        'imbot.app.register',
        registerPayload,
      )
      const appId = parseBitrixNumericId(registerRaw)
      console.log(
        'imbot.app.register result:',
        registerRaw,
        'parsed APP_ID:',
        appId,
      )

      if (appId) {
        await this.applyIframeAppUpdate(bitrixClient, appId, iframeFields)
        console.log('imbot.app.update apos register, APP_ID:', appId)
      }
    } catch (error) {
      console.log('Error running imbot.app.register/update:', error as Error)
    }
  }

  private buildIframeAppFields(): Record<string, unknown> {
    return {
      IFRAME: env.bitrix.chatIframeUrl,
      IFRAME_WIDTH: env.bitrix.chatIframeWidth,
      IFRAME_HEIGHT: env.bitrix.chatIframeHeight,
      HASH: env.bitrix.chatIframeHash,
      ICON_FILE: IFRAME_ICON_BASE64,
      CONTEXT: env.bitrix.chatIframeContext,
      HIDDEN: env.bitrix.chatIframeHidden,
      EXTRANET_SUPPORT: 'N',
      LIVECHAT_SUPPORT: env.bitrix.chatIframeLivechatSupport,
      IFRAME_POPUP: 'N',
      LANG: [...IFRAME_LANG],
    }
  }

  private async applyIframeAppUpdate(
    bitrixClient: BitrixRestClient,
    appId: number,
    fields: Record<string, unknown>,
  ) {
    try {
      await bitrixClient.callMethod('imbot.app.update', {
        APP_ID: appId,
        ...fields,
      })
    } catch (first) {
      try {
        await bitrixClient.callMethod('imbot.app.update', {
          APP_ID: appId,
          FIELDS: fields,
        })
      } catch {
        throw first
      }
    }
  }

  private async getOrCreateThinkzapBot(
    bitrixClient: BitrixRestClient,
  ): Promise<number | null> {
    const webhookUrl = env.bitrix.webhookUrl

    if (!webhookUrl) {
      console.warn(
        'BITRIX_WEBHOOK_URL nao configurado. Nao foi possivel automatizar imbot.register. Defina BITRIX_CHAT_IFRAME_BOT_ID.',
      )
      return null
    }

    const botCode = env.bitrix.chatBotCode

    try {
      const bots = (await bitrixClient.callMethod(
        'imbot.bot.list',
        {},
      )) as Record<string, { ID?: number; CODE?: string; OPENLINE?: string }>
      console.log({ bots })
      const existingBot = Object.values(bots ?? {}).find(
        bot => bot?.CODE === botCode,
      )
      if (existingBot?.ID) {
        if (
          String(env.bitrix.chatIframeContext).startsWith('LINES') &&
          existingBot.OPENLINE === 'N'
        ) {
          console.warn(
            `Bot ${existingBot.ID} tem OPENLINE=N. Para Canais Abertos use um bot de Open Lines (TYPE O) ou outro CODE/BOT_ID.`,
          )
        }
        return existingBot.ID
      }
    } catch (error) {
      console.error(
        'Error listing bots with imbot.bot.list:',
        (error as Error).message,
      )
    }

    try {
      const result = await bitrixClient.callMethod('imbot.register', {
        CODE: botCode,
        TYPE: env.bitrix.chatBotType,
        OPENLINE: env.bitrix.chatBotOpenline,
        EVENT_HANDLER: webhookUrl,
        PROPERTIES: {
          NAME: env.bitrix.chatBotName,
          WORK_POSITION: env.bitrix.chatBotWorkPosition,
        },
      })

      const botId = parseBitrixNumericId(result)
      if (botId) {
        return botId
      }
    } catch (error) {
      console.error(
        'Error creating bot with imbot.register:',
        (error as Error).message,
      )
    }

    return null
  }
}
