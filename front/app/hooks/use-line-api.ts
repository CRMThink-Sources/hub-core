import { useMemo } from 'react'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'

/**
 * Cliente das rotas de linha (`/api/thinkzap/lines/:itemId/*`).
 *
 * `itemId` é o id do item de assinatura. O backend resolve `instanceId` e o token
 * da Z-API a partir dele — **nenhuma credencial trafega para cá**, e o front não
 * tem como pedir uma.
 */
export type LineConnection = {
  connected: boolean
  name?: string
  phone?: string
  imgUrl?: string
  about?: string
  deviceModel?: string
  isBusiness?: boolean
}

export type LineSettingsToggles = {
  prefixOperatorNameEnabled: boolean
  widgetOpenChannelEnabled: boolean
  messageUpdateEventEnabled: boolean
  messageDeleteEventEnabled: boolean
}

/**
 * Sem `provisioned`: toggles e vínculo de canal vivem os dois no item de
 * assinatura, então nenhuma parte da aba depende de registro persistido.
 */
export type LineSettings = {
  name: string
  vinculatedChannel: string | null
  settings: LineSettingsToggles
}

export function useLineApi(itemId: string) {
  return useMemo(() => {
    const base = `/thinkzap/lines/${encodeURIComponent(itemId)}`
    const client = () => axiosThinkzap(appTokenKey(APP_CODES.thinkzap))

    return {
      getConnection: () => client().get<LineConnection>(`${base}/connection`),
      getQrCode: () => client().get<{ value?: string }>(`${base}/qr-code`),
      disconnect: () =>
        client().post<{ disconnected: boolean }>(`${base}/disconnect`),
      getSettings: () => client().get<LineSettings>(`${base}/settings`),
      updateSettings: (payload: {
        name?: string
        settings?: Partial<LineSettingsToggles>
      }) => client().patch<{ saved: boolean }>(`${base}/settings`, payload),
      linkChannel: (lineId: number) =>
        client().post<{ vinculatedChannel: string | null }>(`${base}/channel`, {
          lineId,
        }),
      unlinkChannel: () =>
        client().delete<{ vinculatedChannel: string | null }>(
          `${base}/channel`,
        ),
    }
  }, [itemId])
}
