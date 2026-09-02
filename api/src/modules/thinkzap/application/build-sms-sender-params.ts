import { env } from '@/config/env'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  toSmsSenderCode,
  toSmsTemplateSenderCode,
} from './helpers/sms-sender-code'

/**
 * Corpo de `messageservice.sender.add` / `.update`.
 *
 * `TYPE` é literal `'SMS'` porque é o **único** valor que o método aceita hoje: o
 * provedor aparece sob o rótulo "SMS" na UI do Bitrix mesmo entregando WhatsApp, e
 * não há campo na API onde corrigir isso. `NAME` e `DESCRIPTION` são o único lugar
 * onde a verdade cabe, e é por isso que os dois nomeiam WhatsApp explicitamente.
 */
export type SmsSenderParams = {
  CODE: string
  TYPE: 'SMS'
  HANDLER: string
  NAME: string
  DESCRIPTION: string
}

const PROVIDER_LABEL: Record<SubscriptionItem['metadata']['provider'], string> =
  {
    ZAPI: 'WhatsApp Web',
    HUBMESSAGE: 'WhatsApp Oficial',
    NONE: 'WhatsApp',
  }

export type BuildSmsSenderParamsInput = {
  item: SubscriptionItem
  /**
   * Número conectado na linha, quando conhecido.
   *
   * Opcional porque não vive no item: descobri-lo custa uma chamada ao provider, e
   * pagar essa chamada no registro deixaria o botão do admin refém da Z-API estar de
   * pé. Ausente, a `DESCRIPTION` diz o provider e omite o número.
   */
  phone?: string | null
}

/**
 * Monta o corpo do provedor de mensagem de **uma linha**.
 *
 * Sempre o corpo **inteiro**, nunca parcial — `ensureSmsSender` usa este mesmo
 * retorno no `add` e no `update`. A documentação do Bitrix não garante preservar
 * campo omitido no update, e um update parcial que zerasse o `HANDLER` transformaria
 * as campanhas do cliente em silêncio, não em erro visível.
 */
export function buildSmsSenderParams(
  input: BuildSmsSenderParamsInput,
): SmsSenderParams {
  const { item, phone } = input
  const providerLabel = PROVIDER_LABEL[item.metadata.provider]
  const lineName = item.name.trim() || item.id

  return {
    CODE: toSmsSenderCode(item.id),
    TYPE: 'SMS',
    HANDLER: env.bitrix.smsSender.handlerUrl,
    NAME: `ThinkZap WhatsApp — ${lineName}`,
    DESCRIPTION: phone
      ? `Envia pela linha ${lineName} (${providerLabel}, ${phone})`
      : `Envia pela linha ${lineName} (${providerLabel})`,
  }
}

export type BuildTemplateSenderParamsInput = {
  item: SubscriptionItem
  templateName: string
  language: string
  /** Quantas variáveis distintas o corpo do template consome. */
  parameterCount: number
}

/**
 * Corpo do sender de **um template** de uma linha oficial.
 *
 * O `NAME` é o que o cliente vê no seletor de provedor da campanha, e é por ele que
 * ele escolhe o template — então carrega o nome do template **e** o da linha: o mesmo
 * template aprovado pode existir em duas linhas, e sem a linha os dois apareceriam
 * idênticos na lista.
 *
 * A `DESCRIPTION` diz quantos valores o corpo da campanha precisa trazer. É a única
 * dica que sobrevive dentro do Bitrix — a tela do ThinkZap explica o formato, mas
 * quem monta a campanha está do outro lado.
 */
export function buildTemplateSenderParams(
  input: BuildTemplateSenderParamsInput,
): SmsSenderParams {
  const { item, templateName, language, parameterCount } = input
  const lineName = item.name.trim() || item.id

  return {
    CODE: toSmsTemplateSenderCode(item.id, templateName, language),
    TYPE: 'SMS',
    HANDLER: env.bitrix.smsSender.handlerUrl,
    NAME: `WhatsApp ${lineName} — ${templateName} (${language})`,
    DESCRIPTION:
      parameterCount === 0
        ? `Template ${templateName} pela linha ${lineName}. Não usa variáveis: deixe o texto da campanha vazio.`
        : `Template ${templateName} pela linha ${lineName}. No texto da campanha, informe ${parameterCount} valor(es) na ordem das variáveis, um por linha ou separados por ponto e vírgula.`,
  }
}
