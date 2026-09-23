'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PermissoesSection } from '../_components/permissoes-section'
import { NotificacoesConexaoSection } from '../_components/notificacoes-conexao-section'

type SectionId = 'permissoes' | 'notificacoes'

/**
 * Administração do ThinkZap: quem acessa o app e quem é avisado quando uma linha
 * conecta ou desconecta. As duas seções eram itens separados no menu; juntas aqui
 * porque são as duas configurações de administrador da instalação — o menu e o
 * backend exigem o mesmo papel (`canManageAccess` / `requireThinkzapAdmin`).
 *
 * Estado local, não sub-rota, como as abas da configuração da linha: nada fora
 * desta página aponta para uma seção específica.
 */
export default function AdministracaoPage() {
  const { t } = useTranslation('thinkzap/administracao')
  const [active, setActive] = useState<SectionId>('permissoes')

  const sections: Array<{ id: SectionId; label: string }> = [
    { id: 'permissoes', label: t('tabs.permissoes') },
    { id: 'notificacoes', label: t('tabs.notificacoesConexao') },
  ]

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-4 pt-6 sm:px-6 lg:px-8">
      <nav
        className="flex gap-1 border-b border-border"
        aria-label={t('tabsAriaLabel')}
      >
        {sections.map(section => {
          const isActive = active === section.id
          return (
            <button
              key={section.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActive(section.id)}
              className={`relative cursor-pointer rounded-t-lg px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-card font-semibold text-primary'
                  : 'font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {section.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          )
        })}
      </nav>

      {active === 'permissoes' ? (
        <PermissoesSection />
      ) : (
        <NotificacoesConexaoSection />
      )}
    </div>
  )
}
