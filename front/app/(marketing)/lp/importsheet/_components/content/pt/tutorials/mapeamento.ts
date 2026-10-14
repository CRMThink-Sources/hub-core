import type { Tutorial, MapeamentoScreen } from '../../types'

const tutorial: Tutorial<MapeamentoScreen> = {
  slug: 'mapeamento',
  label: 'Configurar e mapear',
  summary:
    'Destino no Bitrix24, responsável, de-para das colunas e o identificador que evita duplicados.',
  steps: [
    {
      screen: 'identity',
      title: 'Dê um nome e confira a aba',
      description:
        'Nomeie a importação e confira a aba. A linha 1 da aba precisa ter os títulos das colunas; os dados começam em "Importar a partir da linha" (2, por padrão).',
      action: 'Importar a partir da linha',
    },
    {
      screen: 'entity',
      title: 'Escolha a entidade de destino',
      description:
        'Lead, Negócio, Contato, Empresa, SPA, Tarefas ou Livefeed. Negócio pede o pipeline; SPA pede o tipo e depois o pipeline. Livefeed publica um comentário na timeline de um registro que já existe.',
      action: 'Negócio',
    },
    {
      screen: 'responsible',
      title: 'Defina o responsável',
      description:
        'Indique a coluna com o responsável de cada linha e como identificá-lo: ID, e-mail ou telefone de um usuário ativo do Bitrix24.',
      action: 'Responsável identificado por',
    },
    {
      screen: 'options',
      title: 'Crie contato e empresa junto',
      description:
        'Ligue Criar contato e/ou Criar empresa para que a mesma linha também gere o contato e a empresa ligados ao registro.',
      action: 'Criar contato',
    },
    {
      screen: 'mapping',
      title: 'Ligue cada coluna a um campo',
      description:
        'Para cada coluna, escolha o destino (o registro principal, o contato ou a empresa) e o campo no Bitrix24. As etiquetas mostram o tipo do campo: lista, data, S/N, R$. Toda coluna precisa de um campo — as que não interessam, remova pela lixeira.',
      action: 'Contato',
    },
    {
      screen: 'identifier',
      title: 'Marque o identificador',
      description:
        'Marque a coluna que identifica o registro (um código, e-mail ou documento). Se achar 1 registro com esse valor, ele é atualizado; se não achar, é criado; se achar mais de um, a linha fica de fora e aparece nos erros.',
      action: 'Usar como identificador',
    },
    {
      screen: 'save',
      title: 'Salve a importação',
      description:
        'Com tudo mapeado, clique em Salvar. A importação aparece na lista.',
      action: 'Salvar',
    },
  ],
  done: {
    title: 'Importação configurada',
    description:
      'Destino, responsável e de-para salvos. Falta só decidir quando ela roda.',
  },
}

// Sem textos próprios: a chave existe só para manter a forma dos outros tutoriais.
const screens = {}

export type MapeamentoCopy = {
  tutorial: Tutorial<MapeamentoScreen>
  screens: typeof screens
}

export const MAPEAMENTO_PT: MapeamentoCopy = { tutorial, screens }
