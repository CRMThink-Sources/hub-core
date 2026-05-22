import { useCallback, useEffect, useRef, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'

export type BitrixContact = {
  id: string
  name: string
  phones: string[]
}

export function useBitrixContacts(authTokenKey: string) {
  const [contacts, setContacts] = useState<BitrixContact[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (query.trim().length < 2) {
        setContacts([])
        setLoading(false)
        return
      }

      setLoading(true)
      debounceRef.current = setTimeout(() => {
        void (async () => {
          try {
            const client = axiosThinkzap(authTokenKey)
            const result = (await client.get('/thinkzap/contacts', {
              params: { search: query.trim() },
            })) as { contacts: BitrixContact[] }
            setContacts(result.contacts ?? [])
          } catch {
            setContacts([])
          } finally {
            setLoading(false)
          }
        })()
      }, 300)
    },
    [authTokenKey],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return { contacts, loading, search }
}
