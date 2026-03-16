'use client'
import { THINKZAP_ASIDE_CONFIG } from '@/thinkzap-aside-config'
import { Aside } from '@/components/layouts/aside'
import ConexoesLayout from '@/components/layouts/conexoes/conexoes-layout'
import { SessionProvider } from '@/providers/session-provider'

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
