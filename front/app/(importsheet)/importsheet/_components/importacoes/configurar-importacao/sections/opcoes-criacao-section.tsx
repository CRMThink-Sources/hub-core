import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'

type Props = {
  showCreateContact: boolean
  showCreateCompany: boolean
  createContact: boolean
  setCreateContact: (value: boolean) => void
  createCompany: boolean
  setCreateCompany: (value: boolean) => void
}

export function OpcoesCriacaoSection({
  showCreateContact,
  showCreateCompany,
  createContact,
  setCreateContact,
  createCompany,
  setCreateCompany,
}: Props) {
  const { t } = useTranslation('importsheet/configurar-importacao')
  if (!showCreateContact && !showCreateCompany) return null

  return (
    <div className="mt-4 flex flex-wrap gap-6">
      {showCreateContact && (
        <label className="flex cursor-pointer items-center gap-2">
          <Switch checked={createContact} onCheckedChange={setCreateContact} />
          <span className="text-sm text-foreground">
            {t('opcoes.criarContato')}
          </span>
        </label>
      )}
      {showCreateCompany && (
        <label className="flex cursor-pointer items-center gap-2">
          <Switch checked={createCompany} onCheckedChange={setCreateCompany} />
          <span className="text-sm text-foreground">
            {t('opcoes.criarEmpresa')}
          </span>
        </label>
      )}
    </div>
  )
}
