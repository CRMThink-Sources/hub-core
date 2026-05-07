type TableEntry = { code: string; title: string }
type FieldEntry = { code: string; name: string; type: string }

export const tables: TableEntry[] = [
  { code: 'customers', title: 'Clientes' },
  { code: 'sales', title: 'Vendas' },
  { code: 'bills_to_receive', title: 'Contas a Receber' },
  { code: 'products', title: 'Produtos' },
]

export const schema: Record<string, FieldEntry[]> = {
  customers: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'nome', name: 'Nome', type: 'string' },
    { code: 'documento', name: 'CPF/CNPJ', type: 'string' },
    { code: 'email', name: 'E-mail', type: 'string' },
    { code: 'telefone', name: 'Telefone', type: 'string' },
    { code: 'tipo_pessoa', name: 'Tipo de Pessoa', type: 'string' },
    { code: 'ativo', name: 'Ativo', type: 'string' },
    { code: 'endereco.cidade', name: 'Cidade', type: 'string' },
    { code: 'endereco.estado', name: 'Estado', type: 'string' },
    { code: 'endereco.cep', name: 'CEP', type: 'string' },
    { code: 'endereco.logradouro', name: 'Logradouro', type: 'string' },
    { code: 'data_criacao', name: 'Data de Cadastro', type: 'datetime' },
    { code: 'data_alteracao', name: 'Última Alteração', type: 'datetime' },
  ],

  sales: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'numero', name: 'Número', type: 'double' },
    { code: 'situacao.nome', name: 'Status', type: 'string' },
    { code: 'data', name: 'Data da Venda', type: 'date' },
    { code: 'total', name: 'Total', type: 'double' },
    { code: 'cliente.id', name: 'ID do Cliente', type: 'string' },
    { code: 'cliente.nome', name: 'Nome do Cliente', type: 'string' },
    { code: 'cliente.email', name: 'E-mail do Cliente', type: 'string' },
    { code: 'criado_em', name: 'Criado em', type: 'datetime' },
    { code: 'data_alteracao', name: 'Última Alteração', type: 'datetime' },
  ],

  bills_to_receive: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'descricao', name: 'Descrição', type: 'string' },
    { code: 'status', name: 'Status', type: 'string' },
    { code: 'status_traduzido', name: 'Status (PT)', type: 'string' },
    { code: 'total', name: 'Valor Total', type: 'double' },
    { code: 'pago', name: 'Valor Pago', type: 'double' },
    { code: 'nao_pago', name: 'Valor em Aberto', type: 'double' },
    { code: 'data_vencimento', name: 'Vencimento', type: 'date' },
    { code: 'data_competencia', name: 'Data de Competência', type: 'date' },
    { code: 'data_criacao', name: 'Criado em', type: 'datetime' },
    { code: 'data_alteracao', name: 'Última Alteração', type: 'datetime' },
    { code: 'cliente.id', name: 'ID do Cliente', type: 'string' },
    { code: 'cliente.nome', name: 'Nome do Cliente', type: 'string' },
  ],

  products: [
    { code: 'id', name: 'ID', type: 'string' },
    { code: 'nome', name: 'Nome', type: 'string' },
    { code: 'sku', name: 'SKU', type: 'string' },
    { code: 'ean', name: 'EAN', type: 'string' },
    { code: 'ativo', name: 'Ativo', type: 'string' },
    { code: 'valor_venda', name: 'Preço de Venda', type: 'double' },
    { code: 'categoria.nome', name: 'Categoria', type: 'string' },
    { code: 'unidade_medida', name: 'Unidade de Medida', type: 'string' },
  ],
}
