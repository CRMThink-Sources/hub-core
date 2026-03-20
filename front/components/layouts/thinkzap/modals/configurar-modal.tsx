/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { useState, useEffect } from 'react'

interface Connector {
  id: string
  instance: {
    name: string
    phoneNumber: string
    vinculatedChannel: string | null
  }
}

interface IConfigurarProps {
  isOpen: boolean
  connector: Connector | null
  onClose: () => void
  onSave: (id: string, name: string) => void
}

export function ConfigurarModal({
  isOpen,
  connector,
  onClose,
  onSave,
}: IConfigurarProps) {
  const [channel, setChannel] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (connector) {
      setName(connector.instance.name)
    }
  }, [connector])

  if (!isOpen || !connector) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-black">
            Configurar conexão
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2 px-2 pb-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-black">
              Nome do canal
            </label>
            <input
              className="text-sm text-black border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5A997E] focus:border-transparent transition"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-black">Telefone</label>
            <p className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
              {connector.instance.phoneNumber}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-black">Canal</label>
            <select
              value={channel}
              onChange={e => setChannel(e.target.value)}
              className="text-sm text-black border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5A997E] focus:border-transparent transition"
            >
              <option value="Selecione">Selecione</option>
              <option value="Canal 01">Canal 01</option>
              <option value="Canal 02">Canal 02</option>
              <option value="Canal 03">Canal 03</option>
              <option value="Canal 04">Canal 04</option>
              <option value="Canal 05">Canal 05</option>
              <option value="Canal 06">Canal 06</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(connector.id, name)}
            className="px-4 py-2 text-sm font-medium bg-[#5A997E] text-white rounded-md hover:bg-[#4a8169] transition-colors cursor-pointer"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
