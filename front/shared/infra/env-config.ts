export const envConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  appCodes: {
    thinkzap: process.env.NEXT_PUBLIC_THINKZAP_APP_CODE ?? '',
  },
}
