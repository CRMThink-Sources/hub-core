type TableEntry = { code: string; title: string }
type FieldEntry = { code: string; name: string; type: string }

export const tables: TableEntry[] = [
  { code: 'customers', title: 'Clientes' },
  { code: 'orders', title: 'Pedidos' },
  { code: 'invoices', title: 'Notas Fiscais' },
]

export const schema: Record<string, FieldEntry[]> = {}
