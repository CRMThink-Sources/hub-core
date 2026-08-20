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
/**
 * Habilitação da linha, como a api reporta.
 *
 * `trial-expired` é separado de `inactive` porque a tela diz coisas diferentes:
 * teste acabado explica o que houve e oferece contratar; assinatura cancelada é
 * outro assunto.
 */
export type LineEntitlement = 'active' | 'trial-expired' | 'inactive'

export type LineConnection = {
  /**
   * Qual linha a leitura descreve. Os campos abaixo são quase todos do caminho
   * Z-API — sem o provider, a aba teria que adivinhar pela ausência deles se está
   * diante de uma linha oficial ou de uma Z-API que degradou.
   */
  provider: 'ZAPI' | 'HUBMESSAGE'
  connected: boolean
  /**
   * Sempre presente. É o que faz a aba explicar o bloqueio em vez de oferecer um QR
   * code que a rota recusa — as leituras passam mesmo com a linha bloqueada.
   */
  entitlement: LineEntitlement
  name?: string
  phone?: string
  imgUrl?: string
  about?: string
  deviceModel?: string
  isBusiness?: boolean
  /**
   * WABA da linha oficial. Só existe depois do embedded signup — é ela que os
   * templates leem, e é por isso que a aba a mostra.
   */
  wabaId?: string
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
  /** Bloqueada abre a aba em só-leitura: a gravação recusaria com `402`. */
  entitlement: LineEntitlement
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
