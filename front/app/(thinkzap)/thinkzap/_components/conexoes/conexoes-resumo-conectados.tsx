'use client'

type Props = {
  connected: number
  total: number
}

function InfoIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function ConexoesResumoConectados({ connected, total }: Props) {
  return (
    <div className="w-full">
      <div className="inline-flex items-center gap-2 rounded-md border border-[#d9fce6] bg-[#e8fdf0] px-3 py-1.5 text-sm font-medium text-[#5A997E]">
        <InfoIcon />
        <span>
          Números conectados:{' '}
          <strong>
            {connected}/{total}
          </strong>
        </span>
      </div>
    </div>
  )
}
