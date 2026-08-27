import type { LineProvider } from '@/app/hooks/use-line-subscription'

/** Os conectores que o produto conhece, para descartar nome inválido na env. */
const KNOWN_LINE_PROVIDERS: readonly LineProvider[] = ['ZAPI', 'HUBMESSAGE']

/**
 * Conectores liberados quando o ambiente não diz nada.
 *
 * Padrão conservador de propósito: ambiente que esquecer a variável não pode
 * passar a oferecer um conector que estava bloqueado.
 */
const DEFAULT_ENABLED_LINE_PROVIDERS: readonly LineProvider[] = ['ZAPI']

/**
 * Lê a lista de conectores liberados para contratação.
 *
 * Tolerante de propósito — espaço, caixa e nome desconhecido não derrubam a
 * tela. Um typo na configuração vira "esse conector não está liberado", que é
 * o pior caso aceitável; quebrar a página de conexões por causa dele não é.
 */
export function parseEnabledLineProviders(
  raw: string | undefined,
): LineProvider[] {
  const parsed = (raw ?? '')
    .split(',')
    .map(name => name.trim().toUpperCase())
    .filter((name): name is LineProvider =>
      KNOWN_LINE_PROVIDERS.includes(name as LineProvider),
    )

  return parsed.length > 0 ? parsed : [...DEFAULT_ENABLED_LINE_PROVIDERS]
}

export const envConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  /**
   * Publishable key do Stripe — exposta no frontend por desenho, é o par público da
   * secret. Necessária para montar o checkout embedado: o SDK precisa dela junto do
   * `client_secret` que o servidor devolve.
   */
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  // Public Key do SDK @hubmessage/connect — pode ser exposta no frontend.
  hubMessagePublicKey: process.env.NEXT_PUBLIC_HUBMESSAGE_PUBLIC_KEY ?? '',
  hubMessageApiUrl:
    process.env.NEXT_PUBLIC_HUBMESSAGE_API_URL ?? 'https://api.hubmessage.io',
  /**
   * Conectores que a interface deixa contratar (convite ao teste e criação de
   * linha nova). Por ser `NEXT_PUBLIC_*`, o valor é inlinado no build: trocar a
   * lista exige rebuildar a imagem daquele ambiente, não reiniciar o container.
   */
  enabledLineProviders: parseEnabledLineProviders(
    process.env.NEXT_PUBLIC_THINKZAP_ENABLED_PROVIDERS,
  ),
  appCodes: {
    thinkzap: process.env.NEXT_PUBLIC_THINKZAP_APP_CODE ?? '',
    thinkanalise: process.env.NEXT_PUBLIC_THINKANALISE_APP_CODE ?? '',
    importsheet: process.env.NEXT_PUBLIC_IMPORTSHEET_APP_CODE ?? '',
    clicksign: process.env.NEXT_PUBLIC_CLICKSIGN_APP_CODE ?? '',
  },
}
