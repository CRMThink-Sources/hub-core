import { describe, expect, it } from 'vitest'
import ptClients from '@/messages/pt/admin/clients.json'
import enClients from '@/messages/en/admin/clients.json'
import esClients from '@/messages/es/admin/clients.json'
import ptClientDetail from '@/messages/pt/admin/client-detail.json'
import enClientDetail from '@/messages/en/admin/client-detail.json'
import esClientDetail from '@/messages/es/admin/client-detail.json'
import ptAppSettings from '@/messages/pt/admin/app-settings.json'
import enAppSettings from '@/messages/en/admin/app-settings.json'
import esAppSettings from '@/messages/es/admin/app-settings.json'
import ptStatus from '@/messages/pt/admin/status.json'
import enStatus from '@/messages/en/admin/status.json'
import esStatus from '@/messages/es/admin/status.json'
import ptProductUpdates from '@/messages/pt/admin/product-updates.json'
import enProductUpdates from '@/messages/en/admin/product-updates.json'
import esProductUpdates from '@/messages/es/admin/product-updates.json'
import ptUsuarios from '@/messages/pt/admin/usuarios.json'
import enUsuarios from '@/messages/en/admin/usuarios.json'
import esUsuarios from '@/messages/es/admin/usuarios.json'
import ptHome from '@/messages/pt/admin/home.json'
import enHome from '@/messages/en/admin/home.json'
import esHome from '@/messages/es/admin/home.json'

/** Todas as chaves-folha de um objeto de mensagens, como `a.b.c`. */
const leafKeys = (node: unknown, prefix = ''): string[] =>
  node && typeof node === 'object'
    ? Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        leafKeys(value, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix]

/**
 * Os namespaces do backoffice de clientes nos três idiomas: chave que existe num e não
 * no outro vira texto cru (a própria chave) na tela de quem usa aquele idioma.
 */
describe.each([
  ['admin/clients', ptClients, enClients, esClients],
  ['admin/client-detail', ptClientDetail, enClientDetail, esClientDetail],
  ['admin/app-settings', ptAppSettings, enAppSettings, esAppSettings],
  ['admin/status', ptStatus, enStatus, esStatus],
  [
    'admin/product-updates',
    ptProductUpdates,
    enProductUpdates,
    esProductUpdates,
  ],
  ['admin/home', ptHome, enHome, esHome],
  ['admin/usuarios', ptUsuarios, enUsuarios, esUsuarios],
])('%s', (_namespace, pt, en, es) => {
  const ptKeys = leafKeys(pt).sort()

  it('en tem as mesmas chaves que pt', () => {
    expect(leafKeys(en).sort()).toEqual(ptKeys)
  })

  it('es tem as mesmas chaves que pt', () => {
    expect(leafKeys(es).sort()).toEqual(ptKeys)
  })
})
