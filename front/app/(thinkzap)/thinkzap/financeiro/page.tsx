import { THINKZAP_ASIDE_CONFIG } from '@/components/layouts/shared/aside/thinkzap-aside-config'

import PagamentosLayout from '@/components/layouts/thinkzap/financeiro/pagamentos-layout'
import { Aside } from '@/components/layouts/shared/aside/aside'

export default function PagamentosPage() {
  return (
    <div className="flex min-h-screen w-full">
      <Aside {...THINKZAP_ASIDE_CONFIG} />
      <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
        <PagamentosLayout />
      </main>
    </div>
  )
}
