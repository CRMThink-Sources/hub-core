import { env } from '@/config/env'
import { makeTimelineAuthorResolver } from '@/modules/thinkzap/main/make-timeline-author-resolver'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Ícone do ThinkZap no começo do comentário de timeline. O Bitrix busca a imagem
 * direto da URL, então ela precisa ser pública: sai do front (`public/images`) e
 * depende de `FRONT_URL`/`APP_URL`. Sem endereço, o comentário sai sem ícone.
 */
export function timelineBrandIconUrl(): string | undefined {
  const base = env.frontUrl.replace(/\/+$/, '')
  return base ? `${base}/images/thinkzap/timeline-icon.png` : undefined
}

/**
 * O publicador de comentários de timeline do ThinkZap: em nome de quem enviou (quando
 * há token dele) e com o ícone da marca.
 */
export function makeTimelineNotifier(
  bitrix: BitrixClient,
  domainName: string | undefined,
): BitrixLivefeedNotificationService {
  return new BitrixLivefeedNotificationService(
    bitrix,
    domainName ? makeTimelineAuthorResolver(domainName) : undefined,
    timelineBrandIconUrl(),
  )
}
