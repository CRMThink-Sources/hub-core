export const envConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  appCodes: {
    thinkzap: process.env.NEXT_PUBLIC_THINKZAP_APP_CODE ?? '',
    thinkanalise: process.env.NEXT_PUBLIC_THINKANALISE_APP_CODE ?? '',
    importsheet: process.env.NEXT_PUBLIC_IMPORTSHEET_APP_CODE ?? '',
  },
  priceCodes: {
    ThinkzapConnectorsCode:
      process.env.NEXT_PUBLIC_THINKZAP_PRICE_CONNECTORS ?? '',
  },
}
