import { Aside } from '@/components/layouts/shared/aside/aside'
import ConexoesLayout from '@/components/layouts/thinkzap/conexoes/conexoes-layout'
import { THINKZAP_ASIDE_CONFIG } from '@/thinkzap-aside-config'

export default function ConexoesPage() {
  return (
    <div className="flex min-h-screen w-full">
      <Aside {...THINKZAP_ASIDE_CONFIG} />
      <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
        <ConexoesLayout />
      </main>
    </div>
  )
}
