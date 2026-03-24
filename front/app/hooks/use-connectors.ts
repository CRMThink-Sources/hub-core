import { useState } from 'react'

export const useConnectors = () => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [connSelecionado, setConnSelecionado] = useState<any | null>(null)
  const [configurarAberto, setConfigurarAberto] = useState(false)
  const [conectarAberto, setConectarAberto] = useState(false)

  const abrirConfigurar = (conn: any) => {
    setConnSelecionado(conn)
    setConfigurarAberto(true)
  }

  const abrirConectar = (conn: any) => {
    setConnSelecionado(conn)
    setConectarAberto(true)
  }

  return {
    openMenuId,
    setOpenMenuId,
    connSelecionado,
    configurarAberto,
    setConfigurarAberto,
    conectarAberto,
    setConectarAberto,
    abrirConfigurar,
    abrirConectar,
  }
}
