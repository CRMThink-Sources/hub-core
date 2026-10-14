import type { LineProvider } from '@/app/hooks/use-line-subscription'

const KNOWN_LINE_PROVIDERS: readonly LineProvider[] = ['ZAPI', 'HUBMESSAGE']

// Conservador: ambiente que esquecer a env não pode liberar conector bloqueado.
const DEFAULT_ENABLED_LINE_PROVIDERS: readonly LineProvider[] = ['ZAPI']

// Tolerante: typo na env vira "conector não liberado" em vez de quebrar a página.
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
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://homolog-hubthink.crmthink.com.br',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  // Chaves públicas por desenho: seguras no frontend.
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  hubMessagePublicKey: process.env.NEXT_PUBLIC_HUBMESSAGE_PUBLIC_KEY ?? '',
  hubMessageApiUrl:
    process.env.NEXT_PUBLIC_HUBMESSAGE_API_URL ?? 'https://api.hubmessage.io',
  // Inlinado no build: trocar a lista exige rebuildar a imagem, não reiniciar.
  enabledLineProviders: parseEnabledLineProviders(
    process.env.NEXT_PUBLIC_THINKZAP_ENABLED_PROVIDERS,
  ),
  appCodes: {
    thinkzap: process.env.NEXT_PUBLIC_THINKZAP_APP_CODE ?? '',
    thinkanalise: process.env.NEXT_PUBLIC_THINKANALISE_APP_CODE ?? '',
    importsheet: process.env.NEXT_PUBLIC_IMPORTSHEET_APP_CODE ?? '',
    clicksign: process.env.NEXT_PUBLIC_CLICKSIGN_APP_CODE ?? '',
  },
  // Só some com `'false'` explícito: ambiente sem a env não perde o menu.
  thinkbotMenuEnabled:
    process.env.NEXT_PUBLIC_THINKZAP_THINKBOT_MENU_ENABLED !== 'false',
  // Vazio esconde o botão "Instalar no Bitrix24".
  thinkzapMarketUrl: (process.env.NEXT_PUBLIC_THINKZAP_MARKET_URL ?? '').trim(),
  // Aceita formatação; `buildWhatsappLink` extrai os dígitos. Vazio esconde o botão.
  thinkzapSalesWhatsapp: process.env.NEXT_PUBLIC_THINKZAP_SALES_WHATSAPP ?? '',
  // Vazio esconde o botão "Instalar no Bitrix24".
  importsheetMarketUrl: (
    process.env.NEXT_PUBLIC_IMPORTSHEET_MARKET_URL ?? ''
  ).trim(),
  // Aceita formatação; `buildWhatsappLink` extrai os dígitos. Vazio esconde o botão.
  importsheetSalesWhatsapp:
    process.env.NEXT_PUBLIC_IMPORTSHEET_SALES_WHATSAPP ?? '',
  // Vazio esconde o botão "Instalar no Bitrix24".
  clicksignMarketUrl: (
    process.env.NEXT_PUBLIC_CLICKSIGN_MARKET_URL ?? ''
  ).trim(),
  // Aceita formatação; `buildWhatsappLink` extrai os dígitos. Vazio esconde o botão.
  clicksignSalesWhatsapp:
    process.env.NEXT_PUBLIC_CLICKSIGN_SALES_WHATSAPP ?? '',
}
