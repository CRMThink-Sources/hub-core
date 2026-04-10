'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import axios from 'axios'
import { envConfig } from '@/shared/infra/env-config'

const stripePromise = loadStripe(envConfig.stripePublishableKey)

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const quantity = Number(searchParams.get('quantity')) || 1

  const fetchClientSecret = async () => {
    const token = sessionStorage.getItem('hubthink_auth_token')
    console.log(token)
    const { data } = await axios.post(
      `${envConfig.apiUrl}/thinkzap/connector/create`,
      { quantity, priceId: envConfig.priceCodes.ThinkzapConnectorsCode },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return data.result.clientSecret
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/thinkzap/financeiro')}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Voltar
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Checkout</h1>
            <p className="text-sm text-slate-500">
              Comprando {quantity} {quantity === 1 ? 'conector' : 'conectores'}
            </p>
          </div>
        </div>

        {/* Stripe Embedded Checkout */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm backdrop-blur-sm p-8">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{
              fetchClientSecret,
              onComplete: () => router.push('/checkout/success'),
            }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span className="text-sm text-slate-500">
              Carregando checkout...
            </span>
          </div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
