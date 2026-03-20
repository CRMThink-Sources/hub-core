'use client'
import { THINKZAP_ASIDE_CONFIG } from '@/thinkzap-aside-config'
import ConexoesLayout from '@/components/layouts/thinkzap/conexoes/conexoes-layout'
import { SessionProvider } from '@/providers/session-provider'
import { Aside } from '@/components/layouts/shared/aside/aside'

export default function Home() {
  return (
    <SessionProvider>
      <div className="row">
        <Aside {...THINKZAP_ASIDE_CONFIG} activeRoute="/bitrix/conexoes" />
        <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
          <ConexoesLayout />
        </main>
      </div>
    </SessionProvider>
  )
}
