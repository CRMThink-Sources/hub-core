export const CLICKSIGN_ASIDE_CONFIG = {
  logo: '/images/clicksign/logo.png',
  brandIcon:
    'https://www.crmthink.com.br/wp-content/uploads/2020/06/favicon.png',
  brandName: 'CRMThink',
  links: [
    {
      href: '/clicksign/assinatura',
      label: 'Assinatura',
    },
  ],
  linksNamespace: 'clicksign/aside',
  languages: [
    { code: 'pt', flag: '/images/i18n-icon/4x3/br.svg' },
    { code: 'en', flag: '/images/i18n-icon/4x3/us.svg' },
    { code: 'es', flag: '/images/i18n-icon/4x3/es.svg' },
  ],
  bgColor: '#ffffff', // fundo branco
  activeColor: '#f6e6d6', // botao ativo -> tom claro da marca
  activeTextColor: '#C68346', // texto selecionado -> cor base
  inactiveTextColor: '#000000', // texto nao selecionado -> preto
  hoverColor: '#fdf3ea', // hover -> tom bem claro da marca
  borderColor: '#e5e7eb', // borda das caixas
  accentColor: '#C68346', // sobreposicoes -> cor base
  betaMode: true,
}
