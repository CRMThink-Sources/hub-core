import type { Tutorial, NegocioScreen } from '../../types'

const tutorial: Tutorial<NegocioScreen> = {
  slug: 'negocio',
  label: 'Preparar o Negócio',
  summary:
    'Crie os campos do Negócio que guardam o documento e o retorno da assinatura, e escolha as verificações do signatário.',
  steps: [
    {
      screen: 'crm-fields',
      title: 'Crie os campos no Negócio',
      description:
        'Antes de tudo, nas configurações do CRM do Bitrix24, crie estes campos personalizados no Negócio: dois de arquivo (o documento a assinar e o Arquivo Assinado), dois de data (Data Limite e Data de Assinatura) e três de texto (ID do Documento, Status de Assinatura e Processo Finalizado). O app não cria esses campos.',
      action: 'Adicionar campo',
    },
    {
      screen: 'extra-tab',
      title: 'Abra a aba Extra',
      description: 'De volta ao app, em Configurações, clique na aba Extra.',
      action: 'Extra',
    },
    {
      screen: 'additional',
      title: 'Escolha as verificações',
      description:
        'Em Configurações Adicionais, marque o que a Clicksign deve pedir a quem assina: selfie, biometria facial, assinatura manuscrita, foto do documento oficial ou rubrica (a rubrica exige a função de envelope ativa na sua conta). A biometria facial tem custo adicional de R$ 1,50 por biometria facial realizada com sucesso (cobrado pela Clicksign).',
      action: 'Solicitar a foto (frente e verso) do documento oficial',
    },
    {
      screen: 'contact-fields',
      title: 'Aponte os campos do contato',
      description:
        'Em Campos de Contato, escolha o campo do contato que guarda o CPF e o que diz se ele é estrangeiro. É obrigatório quando quem assina é o contato do negócio.',
      action: 'CPF',
    },
    {
      screen: 'save-extra',
      title: 'Salve',
      description: 'Clique em Salvar para guardar a aba Extra.',
      action: 'Salvar',
    },
  ],
  done: {
    title: 'Negócio pronto',
    description:
      'Os campos existem e as verificações estão escolhidas. Agora monte o grupo de assinatura, que liga cada campo ao seu papel.',
  },
}

const screens = {
  crmFields: {
    title: 'Campos personalizados · Negócio',
    name: 'Nome',
    type: 'Tipo',
    add: 'Adicionar campo',
  },
}

export type NegocioCopy = {
  tutorial: Tutorial<NegocioScreen>
  screens: typeof screens
}

export const NEGOCIO_PT: NegocioCopy = { tutorial, screens }
