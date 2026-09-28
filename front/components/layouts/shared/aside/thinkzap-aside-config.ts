export const THINKZAP_ASIDE_CONFIG = {
  logo: '/images/thinkzap/logo-aside.svg',
  homeHref: '/thinkzap',
  brandIcon:
    'https://www.crmthink.com.br/wp-content/uploads/2020/06/favicon.png',
  brandName: 'CRMThink',
  links: [
    {
      href: '/thinkzap',
      label: 'home',
      // icon: '/images/thinkzap/home.png',
    },
    {
      href: '/thinkzap/conexoes',
      label: 'conexoes',
      // icon: '/images/thinkzap/connection.png',
    },
    // `/thinkzap/financeiro` saiu com a cobrança antiga; a tela nova entra aqui.
    // Permissões e notificações de conexão, em sub-abas da mesma página.
    {
      href: '/thinkzap/administracao',
      label: 'administracao',
      // icon: '/images/thinkzap/manual.png',
    },
    {
      href: '/thinkzap/bots',
      label: 'bots',
    },
    {
      href: '/thinkzap/logs',
      label: 'logs',
      // icon: '/images/thinkzap/manual.png',
    },
    // Manual e diretrizes de uso, na mesma página.
    {
      href: '/thinkzap/ajuda',
      label: 'ajuda',
      // icon: '/images/thinkzap/manual.png',
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
