'use client'

import { Aside } from '@/components/layouts/shared/aside/aside'
import { THINKHUB_ASIDE_CONFIG } from '@/components/layouts/shared/aside/thinkhub-aside-config'
import ConfiguracoesLayout from '@/components/layouts/thinkanalise/configuracoes/configuracoes-layout'

export default function ConexoesPage() {
  return (
    <div className="flex min-h-screen w-full">
      <Aside {...THINKHUB_ASIDE_CONFIG} activeRoute="/bitrix/conexoes" />
      <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
        <ConfiguracoesLayout />
      </main>
    </div>
  )
}
