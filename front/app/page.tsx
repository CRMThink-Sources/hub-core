'use client'

import { useEffect, useState } from 'react'
import { BX24Script } from '../bitrix/bx24-script'

type Connector = {
  id: string
  status: 'PENDING_SETUP' | 'ACTIVE' | 'INACTIVE'
  instance: {
    id: string
    instanceId: string
    vinculatedChannel: string | null
  } | null
  createdAt: string
}

const STATUS_LABELS: Record<Connector['status'], string> = {
  PENDING_SETUP: 'Pendente',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
}

const STATUS_COLORS: Record<Connector['status'], string> = {
  PENDING_SETUP: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-slate-100 text-slate-600',
}

export default function Home() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  useEffect(() => {
    async function fetchConnectors() {
      try {
        const res = await fetch('/api/connectors', {
          headers: {
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkb21haW5JZCI6ImU5OTljZDM2LTkxMDItNGFmMC04NjUyLTdiZjNlZDcxMjA0MiIsImFwcENvZGVJZCI6IjEiLCJpYXQiOjE3NzA4NDg3OTl9.m5E0cqb_L683Q3H8aFA9EoKGrRPTgRaOzp1GzFpUItk`,
          },
        })
        const data = await res.json()
        setConnectors(data.result.connectors ?? [])
      } catch {
        setConnectors([])
      } finally {
        setLoading(false)
      }
    }
    void fetchConnectors()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-8">
      <BX24Script onLoad={() => setScriptLoaded(true)} />
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Conectores</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie seus conectores WhatsApp do ThinkersZap.
          </p>
        </div>

        {/* O bloco de comprar conectores saiu com a cobrança antiga: levava para
            `/checkout`, que foi removido junto. A compra volta aqui quando a
            cobrança nova existir. */}

        {/* Tabela de conectores */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
          <div className="border-b border-slate-200/80 px-6 py-4">
            <h2 className="text-lg font-medium text-slate-800">
              Seus conectores
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span className="ml-3 text-sm text-slate-500">Carregando...</span>
            </div>
          ) : connectors.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500">
                Nenhum conector encontrado.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Compre conectores acima para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3 font-medium">ID</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Instância</th>
                    <th className="px-6 py-3 font-medium">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {connectors.map(connector => (
                    <tr
                      key={connector.id}
                      className="transition-colors hover:bg-slate-50/50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-slate-600">
                        {connector.id.slice(0, 8)}...
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[connector.status]}`}
                        >
                          {STATUS_LABELS[connector.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                        {connector.instance
                          ? (connector.instance.vinculatedChannel ??
                            connector.instance.instanceId)
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                        {new Date(connector.createdAt).toLocaleDateString(
                          'pt-BR',
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
