import type { Tutorial, InstalacaoScreen } from '../../types'

const tutorial: Tutorial<InstalacaoScreen> = {
  slug: 'instalacao',
  label: 'Instalação',
  summary: 'Do Bitrix24 Market ao app instalado no seu portal.',
  steps: [
    {
      screen: 'market',
      title: 'Encontre a Clicksign no Market',
      description:
        'No seu Bitrix24, abra o Market, busque por Clicksign e clique no card do app.',
      action: 'Clicksign',
    },
    {
      screen: 'market-app',
      title: 'Instale pela página do app',
      description:
        'A página da Clicksign abre por cima do catálogo, com o desenvolvedor (CRMThink) e a categoria. Clique em Instalar.',
      action: 'Instalar',
    },
    {
      screen: 'install',
      title: 'Aceite os termos e conclua',
      description:
        'Na tela de instalação, aceite os termos do Bitrix24 Market. O e-mail é opcional. A instalação já cria o robô Enviar documento e o campo "[Clicksign] Assinar como" no contato.',
      action: 'Concluir instalação',
    },
  ],
  done: {
    title: 'Clicksign instalada',
    description:
      'O app já está no menu do seu Bitrix24. O próximo passo é conectar a sua conta da Clicksign.',
  },
}

// O tipo sai daqui: os outros idiomas precisam ter as mesmas chaves.
const screens = {
  market: {
    appTagline:
      'Assinatura eletrônica da Clicksign integrada ao CRM do Bitrix24',
    appCategory: 'CRM',
    appsCount: '830+ aplicativos',
    catalog: 'Catálogo',
    scope: 'Todo o Market',
    favorites: 'Favoritos',
    more: 'Mais',
    searchResults: 'Resultados da busca',
    seeAll: 'Todas',
    install: 'Instalar',
    rating: 'Avaliação',
    installs: 'Instalações',
    developer: 'Desenvolvedor',
    category: 'Categoria',
    description: 'Descrição',
  },
  install: {
    title: 'Instalação do aplicativo',
    subtitle: 'Preencha os dados e aceite os termos para concluir.',
    emailLabel: 'E-mail de instalação (opcional)',
    emailPlaceholder: 'seu@empresa.com',
    termsTitle: 'Termos e aceite',
    accept: 'Li e aceito',
    terms: [
      'Termos de uso do Bitrix24 Market',
      'Contrato de licença (EULA)',
      'Política de privacidade',
    ],
    submit: 'Concluir instalação',
  },
}

export type InstalacaoCopy = {
  tutorial: Tutorial<InstalacaoScreen>
  screens: typeof screens
}

export const INSTALACAO_PT: InstalacaoCopy = { tutorial, screens }
