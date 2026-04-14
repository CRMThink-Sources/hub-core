'use client'
import { THINKZAP_ASIDE_CONFIG } from '@/components/layouts/shared/aside/thinkzap-aside-config'
import ConexoesLayout from '@/components/layouts/thinkzap/conexoes/conexoes-layout'
import { Aside } from '@/components/layouts/shared/aside/aside'

export default function Home() {
  return (
    <div className="row">
      <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
        <ConexoesLayout />
      </main>
    </div>
  )
}
