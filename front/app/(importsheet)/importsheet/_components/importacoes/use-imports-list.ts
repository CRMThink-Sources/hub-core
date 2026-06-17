'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type { ImportListItem } from '../types'

const POLL_INTERVAL_MS = 15_000

/**
 * Lista de importações com atualização em tempo real. Seed vem da sessão
 * (render instantâneo), depois faz polling no GET dedicado pra refletir
 * último run / status sem recarregar a sessão inteira. Pausa o polling quando
 * a aba está oculta pra não queimar request à toa.
 */
export function useImportsList(seed: ImportListItem[]) {
  const [imports, setImports] = useState<ImportListItem[]>(seed)
  // Mantém em ref pra reidratar quando a sessão chegar depois do mount.
  const seededRef = useRef(false)

  useEffect(() => {
    if (!seededRef.current && seed.length > 0) {
      seededRef.current = true
      setImports(seed)
    }
  }, [seed])

  const refetch = useCallback(async () => {
    const { imports: next } = (await axiosImportsheet().get(
      '/importsheet/imports',
    )) as unknown as { imports: ImportListItem[] }
    setImports(next)
  }, [])

  useEffect(() => {
    let active = true

    const tick = () => {
      if (document.visibilityState !== 'visible') return
      void refetch().catch(() => {
        // Falha de rede transitória: mantém o estado atual, tenta no próximo ciclo.
      })
    }

    const timer = setInterval(() => {
      if (active) tick()
    }, POLL_INTERVAL_MS)

    // Reaba a aba → atualiza na hora, sem esperar o próximo ciclo.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && active) tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refetch])

  return { imports, refetch }
}
