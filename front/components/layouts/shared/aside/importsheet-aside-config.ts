export const IMPORTSHEET_ASIDE_CONFIG = {
  logo: '/images/importsheet/logo.png',
  brandIcon:
    'https://www.crmthink.com.br/wp-content/uploads/2020/06/favicon.png',
  brandName: 'CRMThink',
  links: [
    {
      href: '/importsheet/importacoes',
      label: 'importacoes',
      // icon: '/images/importsheet/connection.png',
    },
    {
      href: '/importsheet/configuracoes',
      label: 'configuracoes',
      // icon: '/images/importsheet/config.png',
    },
    {
      href: '/importsheet/ajuda',
      label: 'ajuda',
      // icon: '/images/importsheet/ajuda.png',
    },
    // tela de pagamentos - Ainda precisa implementar
    // {
    //   href: '/importsheet/pagamentos',
    //   label: 'Pagamentos',
    //   icon: '/images/importsheet/payments.png',
    // },
    // tela de logs - Ainda precisa definir escopo e demais funcionamentos.
    // {
    //   href: '/importsheet/logs',
    //   label: 'Logs',
    //   icon: '/images/importsheet/logs.png',
    // },
  ],
  linksNamespace: 'importsheet/aside',
  languages: [
    { code: 'pt', flag: '/images/i18n-icon/4x3/br.svg' },
    { code: 'en', flag: '/images/i18n-icon/4x3/us.svg' },
    { code: 'es', flag: '/images/i18n-icon/4x3/es.svg' },
  ],
  bgColor: '#ffffff', // cor de fundo, branco
  activeColor: '#d1fae5', // cor de botao ativo -> verde claro do app
  activeTextColor: '#2E6F40', // texto do item selecionado -> verde da marca
  inactiveTextColor: '#000000', // texto do item nao selecionado -> preto
  hoverColor: '#ecfdf5', // cor que fica ao mouse passar pela opcao -> verde bem claro
  borderColor: '#e5e7eb', // cor da borda das caixas
  accentColor: '#2E6F40', // cor das sobreposicoes -> verde da marca
  betaMode: true,
}
