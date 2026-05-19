export const THINKZAP_ASIDE_CONFIG = {
  logo: '/images/thinkzap/logo.png',
  brandIcon:
    'https://www.crmthink.com.br/wp-content/uploads/2020/06/favicon.png',
  brandName: 'CRMThink',
  links: [
    {
      href: '/thinkzap/conexoes',
      label: 'conexoes',
      icon: '/images/thinkzap/connection.png',
    },
    {
      href: '/thinkzap/financeiro',
      label: 'financeiro',
      icon: '/images/thinkzap/payment.png',
    },
    {
      href: '/thinkzap/ajuda',
      label: 'centralDeAjuda',
      icon: '/images/thinkzap/manual.png',
    },
  ],
  linksNamespace: 'thinkzap/aside',
  languages: [
    { code: 'pt', flag: '/images/i18n-icon/4x3/br.svg' },
    { code: 'en', flag: '/images/i18n-icon/4x3/us.svg' },
    { code: 'es', flag: '/images/i18n-icon/4x3/es.svg' },
  ],
  bgColor: '#F9F9FB', // cor de fundo, branco
  activeColor: '#d9fce6', // cor de botao ativo -> verde claro
  activeTextColor: '#000000', // preto
  hoverColor: '#e8fdf0', // cor que fica ao mouse passar pela opcao
  borderColor: '#e5e7eb', // cor da borda das caixas
  accentColor: '#5A997E', // cor das sobreposicoes
  betaMode: true,
}
