'use client'

import { getBitrixAppInfoFromUrl } from '@/bitrix'
import { envConfig } from '@/shared/infra/env-config'
import { useSearchParams } from 'next/navigation'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  resolveBitrixDomain,
  resolveDialogId,
  resolveImbotAuth,
} from '../_domain/imbot-context'

const UPLOAD_ENDPOINT = '/api/audio/upload'

export type AudioWidgetContextValue = {
  dialogId: string | null
  domain: string | null
  imbotAuth: ReturnType<typeof resolveImbotAuth>
  thinkzapAppCode: string
  uploadEndpoint: string
}

const AudioWidgetContext = createContext<AudioWidgetContextValue | null>(null)

export function useAudioWidgetContext(): AudioWidgetContextValue {
  const value = useContext(AudioWidgetContext)
  if (!value) {
    throw new Error(
      'useAudioWidgetContext must be used within AudioWidgetProvider',
    )
  }
  return value
}

type AudioWidgetProviderProps = {
  children: ReactNode
}

export function AudioWidgetProvider({ children }: AudioWidgetProviderProps) {
  const searchParams = useSearchParams()
  const appInfo = useMemo(() => getBitrixAppInfoFromUrl(), [])
  const urlParams = appInfo.urlParams ?? {}

  const value = useMemo<AudioWidgetContextValue>(() => {
    return {
      dialogId: resolveDialogId(searchParams, urlParams),
      domain: resolveBitrixDomain(searchParams, appInfo.domain),
      imbotAuth: resolveImbotAuth(urlParams),
      thinkzapAppCode: envConfig.appCodes.thinkzap || 'crmthink.thinkzap',
      uploadEndpoint: UPLOAD_ENDPOINT,
    }
  }, [appInfo.domain, searchParams, urlParams])

  return (
    <AudioWidgetContext.Provider value={value}>
      {children}
    </AudioWidgetContext.Provider>
  )
}
