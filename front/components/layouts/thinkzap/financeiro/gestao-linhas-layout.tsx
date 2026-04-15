'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { useSession } from '@/providers/session-provider'
import { envConfig } from '@/shared/infra/env-config'
import { THINKZAP_TRIAL_MAX_CONNECTORS } from '@/shared/constants/thinkzap-trial'
import { AtivarAssinaturaButton } from '../ativar-assinatura-button'
import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'

type ThinkzapPricingResponse = {
  currency: string
  billingScheme: string
  tiersMode: string | null
  tiers: Array<{
    fromQuantity: number
    toQuantity: number | null
    unitAmount: number
    flatAmount: number
  }>
  firstTierUnitAmount: number | null
  estimate: {
    quantity: number
    totalAmountCents: number
    totalAmount: number
  } | null
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const formatPhoneNumber = (phone: string) => {
  if (!phone) return '-'
  const match = phone.match(/^\+(\d{2})(\d{2})(\d{5})(\d{4})$/)
  if (!match) return phone
  return `+${match[1]} ${match[2]} ${match[3]}-${match[4]}`
}

/** Alinhado ao backend: ACTIVE, TRIALING, PAST_DUE permitem aumentar linhas na mesma assinatura. */
function podeAlterarAssinaturaExistente(status: string | undefined): boolean {
  return status === 'ACTIVE' || status === 'TRIALING' || status === 'PAST_DUE'
}

function formatFaixaTiers(fromQ: number, toQ: number | null): string {
  if (toQ === null) return `${fromQ}+`
  if (fromQ === toQ) return `${fromQ}`
  return `${fromQ}–${toQ}`
}

export default function GestaoLinhas() {
  const { session, refreshSession } = useSession()
  const router = useRouter()

  const [quantidade, setQuantidade] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pricing, setPricing] = useState<ThinkzapPricingResponse | null>(null)
  const [pricingLoading, setPricingLoading] = useState(true)
  const [pricingErro, setPricingErro] = useState<string | null>(null)

  const totalLinhas = session?.connectors?.length ?? 0
  const subscription = session?.subscription as
    | {
        status: string
        connectorQuantity: number
        trialEndsAt: string | null
      }
    | null
    | undefined

  const temAssinaturaAjustavel =
    subscription != null && podeAlterarAssinaturaExistente(subscription.status)

  const emTrial = subscription?.status === 'TRIALING'
  /** Trial ou primeira contratação (checkout) — limite de conectores no trial. */
  const limiteTrialAplica = emTrial || !temAssinaturaAjustavel
  const quantidadeMaxPermitida = limiteTrialAplica
    ? Math.max(0, THINKZAP_TRIAL_MAX_CONNECTORS - totalLinhas)
    : 50
  const atingiuLimiteTrial = limiteTrialAplica && quantidadeMaxPermitida < 1

  const linhasNaAssinatura = subscription?.connectorQuantity ?? 0
  const totalAposContratar = temAssinaturaAjustavel
    ? linhasNaAssinatura + quantidade
    : quantidade

  /** Com assinatura: estimativa do valor mensal para o total de linhas após a alteração (ex.: 2 conectores). Sem assinatura: só a contratação nova. */
  const linhasNaEstimativa = temAssinaturaAjustavel
    ? totalAposContratar
    : quantidade

  const valorPrimeiraFaixa = pricing?.firstTierUnitAmount ?? null
  const totalEstimadoApi = pricing?.estimate?.totalAmount ?? null

  useEffect(() => {
    if (quantidadeMaxPermitida < 1) return
    setQuantidade(q => Math.min(Math.max(1, q), quantidadeMaxPermitida))
  }, [quantidadeMaxPermitida, totalLinhas])

  useEffect(() => {
    const key = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey
    if (!key || linhasNaEstimativa < 1) {
      setPricingLoading(false)
      return
    }

    let cancelled = false
    setPricingLoading(true)
    setPricingErro(null)

    void (async () => {
      try {
        const client = axiosThinkzap(key)
        const data = await client.get('/thinkzap/pricing', {
          params: { quantity: linhasNaEstimativa },
        })
        if (!cancelled) {
          setPricing(data as unknown as ThinkzapPricingResponse)
        }
      } catch {
        if (!cancelled) {
          setPricing(null)
          setPricingErro(
            'Não foi possível carregar os preços. Tente novamente.',
          )
        }
      } finally {
        if (!cancelled) setPricingLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [linhasNaEstimativa])

  const handleIncrement = () =>
    setQuantidade(prev =>
      quantidadeMaxPermitida >= 1
        ? Math.min(quantidadeMaxPermitida, prev + 1)
        : prev,
    )
  const handleDecrement = () => setQuantidade(prev => (prev > 1 ? prev - 1 : 1))

  async function handleContinuar() {
    if (quantidade < 1 || atingiuLimiteTrial) return
    if (quantidade > quantidadeMaxPermitida) {
      setErro(
        `No trial você pode ter no máximo ${THINKZAP_TRIAL_MAX_CONNECTORS} conectores.`,
      )
      return
    }
    setErro(null)

    if (temAssinaturaAjustavel) {
      setSubmitting(true)
      try {
        const token = sessionStorage.getItem('hubthink_auth_token')
        if (!token) {
          setErro('Sessão expirada. Entre novamente.')
          return
        }
        const { data: body } = await axios.post<{
          result: { connectorQuantity: number }
        }>(
          `${envConfig.apiUrl}/thinkzap/subscription/add-quantity`,
          { additionalQuantity: quantidade },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        )
        if (body?.result?.connectorQuantity != null) {
          await refreshSession()
        }
      } catch (e: unknown) {
        const msg =
          axios.isAxiosError(e) && e.response?.data?.result?.error
            ? String(
                (e.response.data as { result?: { error?: string } }).result
                  ?.error,
              )
            : 'Não foi possível atualizar a assinatura.'
        setErro(msg)
      } finally {
        setSubmitting(false)
      }
      return
    }

    router.push(`/checkout?quantity=${quantidade}`)
  }

  return (
    <div className="space-y-8">
      <div className="border-t border-gray-200"></div>

      <div className="space-y-4 bg-gray-50 p-5 rounded-lg border border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-black">
            Contratar novas linhas
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Aumente sua capacidade contratando mais linhas.
          </p>
          {limiteTrialAplica && (
            <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2 space-y-3">
              <p>Voce pode ativar o trial de 7 dias para testar o ThinkZap.</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200">
          {erro && (
            <p className="text-sm text-red-600 mb-3" role="alert">
              {erro}
            </p>
          )}
          {temAssinaturaAjustavel && (
            <p className="text-sm text-gray-700 mb-4">
              Sua assinatura tem{' '}
              <span className="font-semibold">{linhasNaAssinatura}</span> linha
              {linhasNaAssinatura !== 1 ? 's' : ''} contratada
              {linhasNaAssinatura !== 1 ? 's' : ''}. Ao confirmar, o total na
              Stripe passará a{' '}
              <span className="font-semibold">{totalAposContratar}</span> linha
              {totalAposContratar !== 1 ? 's' : ''} (pró-rata pode ser cobrado
              conforme regras do Stripe).
            </p>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={submitting}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 font-semibold border border-gray-200 cursor-pointer disabled:opacity-50"
                >
                  −
                </button>
                <span className="text-lg font-semibold text-black min-w-[40px] text-center">
                  {quantidade}
                </span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={
                    submitting ||
                    atingiuLimiteTrial ||
                    quantidade >= quantidadeMaxPermitida
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 font-semibold border border-gray-200 cursor-pointer disabled:opacity-50"
                >
                  +
                </button>
              </div>

              <div className="text-left space-y-1">
                <p className="text-sm text-gray-600">
                  {pricing?.billingScheme === 'tiered'
                    ? '1ª faixa (por linha)'
                    : 'Valor por linha'}
                </p>
                <p className="text-lg font-semibold text-black">
                  {pricingLoading ? (
                    <span className="text-gray-400">Carregando…</span>
                  ) : valorPrimeiraFaixa != null ? (
                    <>R$ {formatCurrency(valorPrimeiraFaixa)}</>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </p>
                {pricing?.billingScheme === 'tiered' &&
                  pricing.tiers.length > 0 && (
                    <ul className="text-xs text-gray-500 space-y-0.5 max-w-md">
                      {pricing.tiers.map((t, i) => (
                        <li key={i}>
                          {formatFaixaTiers(t.fromQuantity, t.toQuantity)} linha
                          {t.toQuantity !== null &&
                          t.toQuantity !== t.fromQuantity
                            ? 's'
                            : ''}
                          : R$ {formatCurrency(t.unitAmount)}
                          /linha
                          {t.flatAmount > 0 && (
                            <> + R$ {formatCurrency(t.flatAmount)} fixo</>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                {pricingErro && (
                  <p className="text-xs text-amber-700">{pricingErro}</p>
                )}
                <p className="text-sm text-gray-600 pt-1">
                  {temAssinaturaAjustavel
                    ? `Valor mensal estimado com ${totalAposContratar} linha${totalAposContratar !== 1 ? 's' : ''} no total (${linhasNaAssinatura} + ${quantidade} adicional${quantidade !== 1 ? 'is' : ''})`
                    : `Total estimado desta contratação (${quantidade} linha${quantidade !== 1 ? 's' : ''})`}
                  {pricing?.tiersMode && (
                    <span className="block text-[11px] text-gray-400 mt-0.5">
                      Modo Stripe:{' '}
                      {pricing.tiersMode === 'graduated'
                        ? 'graduado'
                        : 'volume'}
                    </span>
                  )}
                </p>
                <p className="text-lg font-semibold text-[#5A997E]">
                  {pricingLoading ? (
                    <span className="text-gray-400">…</span>
                  ) : totalEstimadoApi != null ? (
                    <>R$ {formatCurrency(totalEstimadoApi)}</>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleContinuar()}
              disabled={
                submitting ||
                quantidade < 1 ||
                atingiuLimiteTrial ||
                quantidade > quantidadeMaxPermitida
              }
              className="px-5 py-2 text-sm font-medium bg-[#5A997E] text-white rounded-md hover:bg-[#4a8169] transition-colors cursor-pointer disabled:opacity-50 sm:self-start"
            >
              {submitting
                ? 'Processando…'
                : temAssinaturaAjustavel
                  ? 'Confirmar alteração'
                  : 'Continuar'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">
            Linhas contratadas
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-4 items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase">
              Telefone
            </p>
            <p className="text-xs font-semibold text-gray-600 uppercase">
              Nome do canal
            </p>

            <p className="text-xs font-semibold text-gray-600 uppercase text-end">
              Conexão
            </p>
          </div>

          {session?.connectors?.map((conn: any) => {
            const { name, phoneNumber, status, paidStatus } = conn.instance

            let connectionBgColor = ''
            let connectionStatusColor = ''
            let connectionStatusText = ''
            switch (status) {
              case 'ACTIVE':
                connectionBgColor = '#DCFCE7'
                connectionStatusColor = '#144A1B'
                connectionStatusText = 'Ativo'
                break
              case 'PENDING_SETUP':
                connectionBgColor = '#FEF9C3'
                connectionStatusColor = '#854D0E'
                connectionStatusText = 'Configuração pendente'
                break
              default:
                connectionBgColor = '#FEE2E2'
                connectionStatusColor = '#7A1818'
                connectionStatusText = 'Inativo'
                break
            }

            return (
              <div
                key={conn.id}
                className="grid grid-cols-4 gap-4 items-center bg-white p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <p className="text-black font-medium text-sm">
                  {formatPhoneNumber(phoneNumber)}
                </p>
                <p className="text-black font-semibold text-sm">
                  {name || 'Sem nome'}
                </p>

                <div className="flex justify-end">
                  <span
                    className="text-xs font-medium px-2 py-1 rounded-md"
                    style={{
                      color: connectionStatusColor,
                      backgroundColor: connectionBgColor,
                    }}
                  >
                    {connectionStatusText}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <h3 className="inline-flex items-center gap-2 bg-[#F5F5F5] text-[#6B7280] px-3 py-1.5 rounded-md border border-[#E5E7EB] text-sm font-medium">
        Total de linhas: {totalLinhas}
      </h3>
    </div>
  )
}
