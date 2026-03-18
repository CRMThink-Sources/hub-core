'use client'

import { useRouter } from 'next/navigation'

export default function CheckoutSuccessPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-sm backdrop-blur-sm">
        {/* Icone de sucesso */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-600"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-slate-900">
          Pagamento confirmado!
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Seus conectores foram adquiridos com sucesso. Eles aparecerão na sua
          lista em instantes.
        </p>

        <button
          onClick={() => router.push('/')}
          className="mt-8 w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-2"
        >
          Voltar para conectores
        </button>
      </div>
    </div>
  )
}
