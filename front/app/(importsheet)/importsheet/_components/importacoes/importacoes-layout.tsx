'use client'

export default function ImportacoesLayout() {
  return (
    <div className="w-full flex flex-col pt-20 px-6 space-y-4">
      {/* header */}
      <div className="flex items-center justify-between w-full max-w-3xl mx-auto bg-white p-6 rounded-xl border border-[#e5e7eb]">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Importações</h1>
          <h2 className="text-sm text-gray-400 mt-1">
            Área de trabalho de importações
          </h2>
        </div>
      </div>

      {/* conteúdo */}
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
        <p className="text-sm text-gray-400 font-mono px-1">
          criar aqui a tela de importações
        </p>
      </div>
    </div>
  )
}
