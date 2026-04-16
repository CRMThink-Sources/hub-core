import { useCallback, useState } from 'react'

/** Conector da sessão ThinkZap — alinhar a um tipo compartilhado quando existir. */
type Connector = any

export function useConnectors() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [connSelecionado, setConnSelecionado] = useState<Connector | null>(null)
  const [configurarAberto, setConfigurarAberto] = useState(false)
  const [conectarAberto, setConectarAberto] = useState(false)
  const [vincularAberto, setVincularAberto] = useState(false)
  const [connVincular, setConnVincular] = useState<Connector | null>(null)
  const [desvincularAberto, setDesvincularAberto] = useState(false)
  const [connDesvincular, setConnDesvincular] = useState<Connector | null>(null)
  const [desconectarAberto, setDesconectarAberto] = useState(false)
  const [connDesconectar, setConnDesconectar] = useState<Connector | null>(null)

  const menu = {
    openConnectorId: openMenuId,
    toggle: useCallback((connectorId: string) => {
      setOpenMenuId(prev => (prev === connectorId ? null : connectorId))
    }, []),
    close: useCallback(() => setOpenMenuId(null), []),
  }

  const edit = {
    isOpen: configurarAberto,
    connector: connSelecionado,
    open: useCallback((conn: Connector) => {
      setConnSelecionado(conn)
      setConfigurarAberto(true)
    }, []),
    close: useCallback(() => setConfigurarAberto(false), []),
  }

  const connect = {
    isOpen: conectarAberto,
    connector: connSelecionado,
    open: useCallback((conn: Connector) => {
      setConnSelecionado(conn)
      setConectarAberto(true)
    }, []),
    close: useCallback(() => setConectarAberto(false), []),
  }

  const linkChannel = {
    isOpen: vincularAberto,
    connector: connVincular,
    open: useCallback((conn: Connector) => {
      setConnVincular(conn)
      setVincularAberto(true)
    }, []),
    close: useCallback(() => setVincularAberto(false), []),
  }

  const unlinkChannel = {
    isOpen: desvincularAberto,
    connector: connDesvincular,
    open: useCallback((conn: Connector) => {
      setConnDesvincular(conn)
      setDesvincularAberto(true)
    }, []),
    close: useCallback(() => setDesvincularAberto(false), []),
  }

  const disconnect = {
    isOpen: desconectarAberto,
    connector: connDesconectar,
    open: useCallback((conn: Connector) => {
      setConnDesconectar(conn)
      setDesconectarAberto(true)
    }, []),
    close: useCallback(() => setDesconectarAberto(false), []),
  }

  return {
    menu,
    edit,
    connect,
    linkChannel,
    unlinkChannel,
    disconnect,
  }
}
