export const envConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  // Public Key do SDK @hubmessage/connect — pode ser exposta no frontend.
  hubMessagePublicKey: process.env.NEXT_PUBLIC_HUBMESSAGE_PUBLIC_KEY ?? '',
  hubMessageApiUrl:
    process.env.NEXT_PUBLIC_HUBMESSAGE_API_URL ?? 'https://api.hubmessage.io',
  appCodes: {
    thinkzap: process.env.NEXT_PUBLIC_THINKZAP_APP_CODE ?? '',
    thinkanalise: process.env.NEXT_PUBLIC_THINKANALISE_APP_CODE ?? '',
    importsheet: process.env.NEXT_PUBLIC_IMPORTSHEET_APP_CODE ?? '',
    clicksign: process.env.NEXT_PUBLIC_CLICKSIGN_APP_CODE ?? '',
  },
  priceCodes: {
    ThinkzapConnectorsCode:
      process.env.NEXT_PUBLIC_THINKZAP_PRICE_CONNECTORS ?? '',
  },
}
