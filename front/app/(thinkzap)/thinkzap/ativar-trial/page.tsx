import { AtivarTrialForm } from './ativar-trial-form'

export default function AtivarTrialPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Ativar trial
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Preencha seus dados para ativar o trial de 7 dias do ThinkZap.
          </p>
        </div>
        <AtivarTrialForm />
      </div>
    </div>
  )
}
