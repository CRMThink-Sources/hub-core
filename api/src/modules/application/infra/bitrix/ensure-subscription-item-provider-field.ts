import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  SpaTextFieldIsEnumerationError,
  SpaTextFieldMissingError,
  ensureSpaTextField,
} from './ensure-spa-text-field'

/**
 * Campo da SPA 1146 que diz **qual provider** o item de assinatura usa.
 *
 * Existe porque o provider era adivinhado: o mapper concluía `ZAPI` ou
 * `HUBMESSAGE` por quais credenciais estavam preenchidas, e nada preenchido virava
 * `NONE`. Isso amarrava a identidade do conector à presença da credencial — um item
 * que perdia a credencial sumia da lista de linhas em silêncio, e "item de cobrança
 * sem conector" era indistinguível de "campo que ninguém preencheu".
 *
 * Campo de **texto** com `ZAPI`, `HUBMESSAGE` ou `NONE`, o mesmo vocabulário de
 * `SubscriptionItemMetadata.provider`. `NONE` é escrito como literal, nunca deixado
 * vazio: vazio significa não preenchido, e reprova o item.
 *
 * Tem que ser texto e não lista pelo motivo registrado em `ensureSpaTextField`:
 * campo de lista devolve o id de enum gerado pelo portal, não o valor, e a leitura
 * literal nunca reconheceria o que foi gravado.
 */
export const SUBSCRIPTION_ITEM_PROVIDER_FIELD = 'ufCrm93Provider' as const

/**
 * Mantidos como aliases dos erros compartilhados, como na modalidade: o tipo do
 * erro faz parte do contrato de quem trata este caso.
 */
export {
  SpaTextFieldIsEnumerationError as SubscriptionItemProviderFieldIsEnumerationError,
  SpaTextFieldMissingError as SubscriptionItemProviderFieldMissingError,
}

/**
 * Garante que o campo de provider existe na SPA de itens, e que ele é legível pelo
 * mapper.
 *
 * **O que a ausência quebra:** a leitura do item serve billing, lista de linhas e
 * roteamento de mensagem. Sem o campo, todo item reprova o parse e os três caem
 * juntos — por isso a verificação roda no diagnóstico, antes do deploy, e não
 * depois do primeiro erro em produção.
 *
 * Diferente da modalidade, esta verificação **não** é pendurada em cada escrita: a
 * leitura já é estrita e falha alto no parse seguinte, então uma checagem por
 * escrita pagaria uma chamada ao Bitrix para detectar o que o próximo parse detecta
 * de graça.
 */
export async function ensureSubscriptionItemProviderField(
  bitrix: BitrixClient,
  entityTypeId: number = env.payments.spa.subscriptionItemEntityType,
): Promise<void> {
  await ensureSpaTextField({
    bitrix,
    entityTypeId,
    field: SUBSCRIPTION_ITEM_PROVIDER_FIELD,
    hint:
      'Use "ZAPI", "HUBMESSAGE" ou "NONE" em todos os itens — inclusive "NONE" nos ' +
      'itens de cobrança sem conector, que não podem ficar vazios. Sem o campo ' +
      'preenchido a leitura do item reprova, e billing, lista de linhas e roteamento ' +
      'de mensagem param juntos.',
  })
}
