export const THINKHUB_ASIDE_CONFIG = {
  logo: '/images/thinkhub/logo.png',
  brandIcon:
    'https://www.crmthink.com.br/wp-content/uploads/2020/06/favicon.png',
  brandName: 'CRMThink',
  links: [
    {
      href: '/thinkanalise/configuracoes',
      label: 'Configurações',
      // icon: '/images/thinkhub/config.png',
    },
    {
      href: '/thinkanalise/ajuda',
      label: 'Ajuda',
      // icon: '/images/thinkhub/manual.png',
    },
  ],
  languages: [
    { code: 'pt', flag: '/images/i18n-icon/4x3/br.svg' },
    { code: 'en', flag: '/images/i18n-icon/4x3/us.svg' },
    { code: 'es', flag: '/images/i18n-icon/4x3/es.svg' },
  ],
  bgColor: '#F9F9FB', // cor de fundo, branco
  activeColor: '#dbeafe', // cor de botao ativo -> azul claro
  activeTextColor: '#3b82f6', // texto do item selecionado -> azul da marca
  inactiveTextColor: '#000000', // texto do item nao selecionado -> preto
  hoverColor: '#eff6ff', // cor que fica ao mouse passar pela opcao
  borderColor: '#e5e7eb', // cor da borda das caixas
  accentColor: '#3b82f6', // cor das sobreposicoes
  betaMode: true,
}
