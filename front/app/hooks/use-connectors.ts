import { useState } from 'react'

export const useConnectors = () => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [connSelecionado, setConnSelecionado] = useState<any | null>(null)
  const [configurarAberto, setConfigurarAberto] = useState(false)
  const [conectarAberto, setConectarAberto] = useState(false)
  const [vincularAberto, setVincularAberto] = useState(false)
  const [connVincular, setConnVincular] = useState<any>(null)

  const abrirConfigurar = (conn: any) => {
    setConnSelecionado(conn)
    setConfigurarAberto(true)
  }

  const abrirConectar = (conn: any) => {
    setConnSelecionado(conn)
    setConectarAberto(true)
  }

  const abrirVincular = (conn: any) => {
    setConnVincular(conn)
    setVincularAberto(true)
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
    abrirVincular,
    vincularAberto,
    setVincularAberto,
    connVincular,
    setConnVincular,
  }
}
