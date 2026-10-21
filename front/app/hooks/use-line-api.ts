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
  /** Limite diário de envio — só a linha não oficial (Z-API) aceita gravar. */
  dailyLimitEnabled: boolean
  /** Inteiro > 0 quando ligado; `null` = nunca configurado. */
  dailyLimit: number | null
  /** Espelha no canal aberto o que é enviado do aparelho — só a linha não oficial. */
  deviceMessageMirrorEnabled: boolean
  /** Cadência de envio — só a linha não oficial. N por janela de D minutos. */
  cadenceEnabled: boolean
  cadenceMaxMessages: number | null
  cadenceWindowMinutes: number | null
  /** Pausa de P minutos ao atingir N; substitui o resto da janela. */
  cadencePauseEnabled: boolean
  cadencePauseMinutes: number | null
}

/** De onde veio uma mensagem da fila de saída. */
export type OutboxOrigin =
  | 'WIDGET'
  | 'WIDGET_ATTACHMENT'
  | 'ROBOT_MESSAGE'
  | 'ROBOT_BUTTONS'
  | 'ROBOT_TEMPLATE'
  | 'SMS_CAMPAIGN'
  | 'OPERATOR'
  | 'BOT'

/** Uma mensagem aguardando na fila da linha. Horários em epoch ms. */
export type CadenceQueueItem = {
  /** 1 = a próxima a sair. */
  position: number
  origin: OutboxOrigin
  destination: string
  /** Texto, legenda ou nome do arquivo, já cortado; `null` = mídia sem nome. */
  preview: string | null
  mediaType: 'image' | 'video' | 'audio' | 'document' | null
  enqueuedAt: number
  /** Saída prevista (fim da janela/pausa), quando já esperou alguma. */
  waitUntil: number | null
}

/** As primeiras mensagens da fila, na ordem de saída, e o total. */
export type CadenceQueueListing = {
  total: number
  messages: CadenceQueueItem[]
}

/**
 * Estado atual da cadência da linha, como a api lê do Redis. Horários em epoch ms.
 */
export type CadenceState = {
  /** A instalação pode ativar o recurso (liberação gradual). */
  available: boolean
  phase: 'idle' | 'window' | 'paused'
  count: number
  max: number | null
  windowEndsAt: number | null
  pauseUntil: number | null
  /** Mensagens na fila da linha esperando vaga. */
  waiting: number
  /** A configuração gravada difere da janela/pausa vigente: vale na próxima. */
  nextWindowChanges: boolean
}

/**
 * Uso do limite diário de hoje, como a api calcula. A tela só exibe: o percentual
 * tem uma fórmula só, no backend.
 */
export type DailyLimitUsage = {
  enabled: boolean
  limit: number | null
  sentToday: number
  extraToday: number
  /** Limite + extras de hoje. `null` com o limite desligado. */
  effectiveLimit: number | null
  /** Quanto falta até o limite efetivo, em %. `null` com o limite desligado. */
  remainingPercent: number | null
  reached: boolean
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
  /**
   * Uso do dia. Ausente na linha oficial (sem limite); `null` na Z-API quando o
   * contador não pôde ser lido — o card abre sem o uso.
   */
  dailyLimit?: DailyLimitUsage | null
  /** Estado da cadência. Ausente na linha oficial; `null` quando não pôde ser lido. */
  cadence?: CadenceState | null
}

export type SmsProviderResult = 'created' | 'updated' | 'skipped' | 'deleted'

/**
 * Estado do provedor de mensagem da linha na campanha de SMS do Bitrix.
 *
 * Leitura própria e não um campo de `LineSettings`: saber isto custa uma chamada ao
 * Bitrix, e pendurá-la nos ajustes poria uma ida à rede em toda abertura da aba.
 */
export type LineSmsProvider = {
  registered: boolean
  /** `CODE` do sender — é o que a campanha devolve para reencontrar a linha. */
  code: string
  /** `false` no ambiente sem a rota do handler publicada: registrar seria no-op. */
  available: boolean
  /** Linha não oficial: disparo em massa arrisca bloqueio do número pela Meta. */
  banRisk: boolean
  /** Linha oficial: o provedor é por template, na aba de Templates. */
  perTemplate: boolean
}

/**
 * Um template aprovado da linha oficial e o estado dele na campanha de SMS.
 *
 * O provedor é **por template**, não por linha: a lista de provedores do Bitrix é o
 * seletor de template, porque o payload que o handler recebe não carrega template
 * nenhum e o corpo chega com os placeholders de CRM já resolvidos.
 */
export type TemplateProvider = {
  templateName: string
  language: string
  /** Corpo aprovado com os placeholders intactos — a tela monta o exemplo dele. */
  body: string
  /** Quantos valores o texto da campanha precisa trazer. */
  parameterCount: number
  /** Link dinâmico ou copiar código: a campanha não consegue enviar. */
  hasDynamicButton: boolean
  /**
   * Imagem no cabeçalho: a campanha não consegue enviar. Opcional porque uma API
   * anterior a este campo não o manda.
   */
  hasImageHeader?: boolean
  registered: boolean
  code: string
}

export type LineTemplateProviders = {
  available: boolean
  templates: TemplateProvider[]
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
      /** Mensagens aguardando na fila da linha (cadenciador), na ordem de saída. */
      getCadenceQueue: () =>
        client().get<CadenceQueueListing>(`${base}/cadence/queue`),
      /** Soma mensagens extras ao limite **só de hoje**; devolve o uso atualizado. */
      releaseDailyLimitExtra: (amount: number) =>
        client().post<{ dailyLimit: DailyLimitUsage }>(
          `${base}/daily-limit/extra`,
          { amount },
        ),
      linkChannel: (lineId: number) =>
        client().post<{ vinculatedChannel: string | null }>(`${base}/channel`, {
          lineId,
        }),
      unlinkChannel: () =>
        client().delete<{ vinculatedChannel: string | null }>(
          `${base}/channel`,
        ),
      getSmsProvider: () =>
        client().get<LineSmsProvider>(`${base}/sms-provider`),
      registerSmsProvider: () =>
        client().post<{ result: SmsProviderResult }>(`${base}/sms-provider`),
      removeSmsProvider: () =>
        client().delete<{ result: SmsProviderResult }>(`${base}/sms-provider`),
      getSmsTemplates: () =>
        client().get<LineTemplateProviders>(`${base}/sms-templates`),
      registerSmsTemplate: (input: {
        templateName: string
        language: string
      }) =>
        client().post<{ result: SmsProviderResult }>(
          `${base}/sms-templates`,
          input,
        ),
      removeSmsTemplate: (input: { templateName: string; language: string }) =>
        client().delete<{ result: SmsProviderResult }>(
          `${base}/sms-templates`,
          { data: input },
        ),
    }
  }, [itemId])
}
