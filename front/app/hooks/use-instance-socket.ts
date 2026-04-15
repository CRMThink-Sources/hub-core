import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { envConfig } from '@/shared/infra/env-config'

export function useInstanceSocket({
  instanceId,
  enabled,
  onConnected,
}: {
  instanceId: string | null
  enabled: boolean
  onConnected: () => void
}) {
  const onConnectedRef = useRef(onConnected)
  onConnectedRef.current = onConnected

  useEffect(() => {
    if (!enabled || !instanceId) return

    const socketUrl = new URL(envConfig.apiUrl).origin

    const socket = io(socketUrl, {
      autoConnect: false,
      path: '/api/socket.io',
    })

    socket.on('connect', () => {
      socket.emit('join', instanceId)
    })

    socket.on('instance:connected', (data: unknown) => {
      onConnectedRef.current?.()
    })
    socket.connect()

    return () => {
      socket.emit('leave', instanceId)
      socket.disconnect()
    }
  }, [enabled, instanceId])
}
