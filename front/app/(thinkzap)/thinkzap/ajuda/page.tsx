import { Aside } from '@/components/layouts/shared/aside/aside'
import { THINKZAP_ASIDE_CONFIG } from '@/components/layouts/shared/aside/thinkzap-aside-config'

export default function AjudaPage() {
  return (
    <div className="flex">
      <Aside {...THINKZAP_ASIDE_CONFIG} />
      <main className="flex-1 p-6 border-l border-gray-300 h-screen">
        <div className="border-4 border-dashed border-red-500 h-full flex items-center justify-center">
          <h1 className="text-2xl font-bold text-red-600">
            EM DESENVOLVIMENTO - AJUDA
          </h1>
        </div>
      </main>
    </div>
  )
}
