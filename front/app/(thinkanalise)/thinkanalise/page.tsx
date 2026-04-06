'use client'

import { Aside } from '@/components/layouts/shared/aside/aside'
import { THINKANALISE_ASIDE_CONFIG } from '@/components/layouts/shared/aside/thinkanalise-aside-config'
import ConexoesLayout from '@/components/layouts/thinkanalise/conexoes/conexoes-layout'

export default function Home() {
  return (
    <div className="flex min-h-screen w-full">
      <Aside {...THINKANALISE_ASIDE_CONFIG} activeRoute="/bitrix/conexoes" />
      <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
        <ConexoesLayout />
      </main>
    </div>
  )
}
