'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'Erro de configuração no servidor.',
  AccessDenied: 'Acesso negado.',
  Verification: 'Link de verificação expirado ou já utilizado.',
  Default: 'Ocorreu um erro durante a autenticação.',
}

function BitrixErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') ?? 'Default'
  const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Erro de autenticação</h1>
      <p className="text-muted-foreground text-center text-sm">{message}</p>
      <Link href="/" className="text-primary hover:underline">
        Voltar para a página inicial
      </Link>
    </div>
  )
}

export default function BitrixErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          Carregando...
        </div>
      }
    >
      <BitrixErrorContent />
    </Suspense>
  )
}
