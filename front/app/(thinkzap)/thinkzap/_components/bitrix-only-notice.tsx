import Image from 'next/image'
import Link from 'next/link'
import { Lock } from 'lucide-react'

type Props = {
  /** Página do app no Bitrix24 Market; vazia esconde "Instalar no Bitrix24". */
  marketUrl: string
}

/**
 * Tela de `/thinkzap/**` aberto fora do iframe do Bitrix24. Sem Aside e sem
 * nenhum provider: fora do Bitrix não há token nem BX24, então nada aqui chama a
 * API. Texto fixo em pt-BR pelo mesmo motivo — não há locale do app garantido.
 */
export function BitrixOnlyNotice({ marketUrl }: Props) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <Image
          src="/images/thinkzap/logo.png"
          alt="ThinkZap"
          width={130}
          height={60}
          className="mx-auto h-10 w-auto"
        />
        <span className="mx-auto mt-6 flex size-12 items-center justify-center rounded-full bg-accent text-primary">
          <Lock aria-hidden className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-foreground">
          Página restrita ao Bitrix24
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          O ThinkZap é usado dentro do seu portal Bitrix24. Para acessar, abra o
          aplicativo pelo menu do Bitrix24.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/lp/thinkzap"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Conhecer o ThinkZap
          </Link>
          {marketUrl && (
            <a
              href={marketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-primary/40 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-accent"
            >
              Instalar no Bitrix24
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
