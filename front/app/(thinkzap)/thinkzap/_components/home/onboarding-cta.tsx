import Link from 'next/link'
import { MessageCirclePlus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Estado vazio da home: nenhuma linha ativa de nenhum provider. */
export function OnboardingCta() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MessageCirclePlus className="size-7" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">
          Nenhum WhatsApp conectado ainda
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Conecte uma linha de WhatsApp Web ou Business para começar a ver suas
          estatísticas de mensagens aqui.
        </p>
      </div>
      <Link
        href="/thinkzap/conexoes"
        className={cn(buttonVariants({ variant: 'default' }))}
      >
        Conectar WhatsApp
      </Link>
    </div>
  )
}
