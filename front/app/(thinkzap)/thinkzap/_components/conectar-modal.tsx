import { useState, useEffect, useRef } from 'react'
import { useInstanceSocket } from '@/app/hooks/use-instance-socket'

interface IConectarProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (id: string) => void
  qrCode: string | null
  instanceId: string | null
  loading?: boolean
  onRefetch?: () => void
}

export function ConectarModal({
  isOpen,
  onClose,
  onSave,
  qrCode,
  instanceId,
  loading = false,
  onRefetch,
}: IConectarProps) {
  const [timeLeft, setTimeLeft] = useState(20)
  const [expired, setExpired] = useState(false)

  useInstanceSocket({
    instanceId,
    enabled: isOpen,
    onConnected: onClose,
  })

  useEffect(() => {
    if (!isOpen || !qrCode) return

    setTimeLeft(20)
    setExpired(false)

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, qrCode])

  if (!isOpen) return null

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-green-600" />
          <p className="text-sm text-gray-500">Gerando QR Code...</p>
        </div>
      )
    }

    if (qrCode && !expired) {
      return (
        <div className="flex flex-col items-center gap-3 py-4">
          <img src={qrCode} alt="QR Code" className="w-48 h-48" />
          <p className="text-sm text-gray-500">
            Escaneie o QR Code com o WhatsApp
          </p>
          <p className="text-sm text-red-500">Expira em: {timeLeft}s</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <svg
            className="h-7 w-7 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">QR Code expirado</p>
          <p className="text-xs text-gray-400 mt-1">
            Gere um novo para continuar
          </p>
        </div>
        {onRefetch && (
          <button
            onClick={onRefetch}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Gerar novo QR Code
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-black">Conectar</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
        {renderContent()}
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
