export const IMPORTSHEET_ASIDE_CONFIG = {
  logo: '/images/importsheet/logo.png',
  brandIcon: '/images/importsheet/brand-icon.png',
  brandName: 'CRMThink',
  links: [
    {
      href: '/importsheet/importacoes',
      label: 'Importações',
      icon: '/images/importsheet/connection.png',
    },
    {
      href: '/importsheet/configuracoes',
      label: 'Configurações',
      icon: '/images/importsheet/config.png',
    },
    {
      href: '/importsheet/ajuda',
      label: 'Ajuda',
      icon: '/images/importsheet/ajuda.png',
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
  languages: [
    { code: 'pt', flag: '/images/i18n-icon/4x3/br.svg' },
    { code: 'en', flag: '/images/i18n-icon/4x3/us.svg' },
    { code: 'es', flag: '/images/i18n-icon/4x3/es.svg' },
  ],
  bgColor: '#ffffff', // cor de fundo, branco
  activeColor: '#f3f4f6', // cor de botao ativo -> cinza claro
  activeTextColor: '#111827', // texto do item -> quase preto
  hoverColor: '#f9fafb', // cor que fica ao mouse passar pela opcao
  borderColor: '#e5e7eb', // cor da borda das caixas
  accentColor: '#111827', // cor das sobreposicoes -> quase preto
  betaMode: true,
}
