'use client'

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useLoading } from '@/providers/loading-provider'
import type { ImportInitial, ImportSelection } from '../../types'
import { useConfigurarImportacao } from './use-configurar-importacao'
import { IdentidadeSection } from './sections/identidade-section'
import { DestinoSection } from './sections/destino-section'
import { ResponsavelSection } from './sections/responsavel-section'
import { OpcoesCriacaoSection } from './sections/opcoes-criacao-section'
import { AgendamentoSection } from './sections/agendamento-section'
import { DeParaSection } from './sections/de-para-section'

type Props = {
  open: boolean
  selection: ImportSelection
  initial?: ImportInitial | null
  onClose: () => void
  onSaved: () => void
  onBack: () => void
}

export function ConfigurarImportacaoModal({
  open,
  selection,
  initial,
  onClose,
  onSaved,
  onBack,
}: Props) {
  const { t } = useTranslation('importsheet/configurar-importacao')
  const s = useConfigurarImportacao(open, selection, initial)
  const { flags } = s
  const { setLoading } = useLoading()

  async function handleSave() {
    setLoading(true, t(s.isEdit ? 'modal.salvando' : 'modal.criando'))
    try {
      await s.handleSave()
      toast.success(t(s.isEdit ? 'modal.atualizada' : 'modal.criada'))
      onSaved()
    } catch {
      toast.error(t('modal.erroSalvar'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (next) return
        if (details.reason === 'outside-press') return
        onClose()
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {t(s.isEdit ? 'modal.tituloEditar' : 'modal.tituloCriar')}
          </DialogTitle>
          <DialogDescription>{t('modal.descricao')}</DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-4 border-b border-border px-6 py-5">
          <IdentidadeSection
            spreadsheet={s.spreadsheet}
            title={s.title}
            setTitle={s.setTitle}
            startRow={s.startRow}
            setStartRow={s.setStartRow}
            selectedTabId={s.selectedTabId}
            setSelectedTabId={s.setSelectedTabId}
          />
          <DestinoSection
            entityCode={s.entityCode}
            setEntityCode={s.setEntityCode}
            setSpaTypeId={s.setSpaTypeId}
            needsPipeline={flags.needsPipeline}
            categoryId={s.categoryId}
            setCategoryId={s.setCategoryId}
            categories={s.categories}
            categoriesLoading={s.categoriesLoading}
            needsSpa={flags.needsSpa}
            spaTypeId={s.spaTypeId}
            spas={s.spas}
          />
        </div>

        <DialogBody className="flex flex-col gap-5">
          <ResponsavelSection
            isFeed={flags.isFeed}
            visibleColumns={s.visibleColumns}
            responsibleColumnIndex={s.responsibleColumnIndex}
            setResponsibleColumnIndex={s.setResponsibleColumnIndex}
            responsibleMatchBy={s.responsibleMatchBy}
            setResponsibleMatchBy={s.setResponsibleMatchBy}
          />

          <OpcoesCriacaoSection
            showCreateContact={flags.showCreateContact}
            showCreateCompany={flags.showCreateCompany}
            createContact={s.createContact}
            setCreateContact={s.setCreateContact}
            createCompany={s.createCompany}
            setCreateCompany={s.setCreateCompany}
          />

          <AgendamentoSection
            scheduleManual={s.scheduleManual}
            setScheduleManual={s.setScheduleManual}
            scheduleType={s.scheduleType}
            setScheduleType={s.setScheduleType}
            everyHours={s.everyHours}
            setEveryHours={s.setEveryHours}
            weekdays={s.weekdays}
            toggleWeekday={s.toggleWeekday}
          />

          {s.error && (
            <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {s.error}
            </div>
          )}

          <DeParaSection
            entitySelected={flags.entity !== null}
            isFeed={flags.isFeed}
            perColumn={flags.perColumn}
            header={s.header}
            headerLoading={s.headerLoading}
            fieldsLoading={s.fieldsLoading}
            visibleColumns={s.visibleColumns}
            mappedCount={s.mappedCount}
            feedMappedCount={s.feedMappedCount}
            mappings={s.mappings}
            fieldOptionsByTarget={s.fieldOptionsByTarget}
            destinations={s.destinations}
            excluded={s.excluded}
            setMapping={s.setMapping}
            setMappingTarget={s.setMappingTarget}
            toggleIdentifier={s.toggleIdentifier}
            excludeColumn={s.excludeColumn}
            restoreColumn={s.restoreColumn}
            setFeedColumn={s.setFeedColumn}
          />
        </DialogBody>

        <DialogFooter className="justify-between">
          {s.isEdit ? (
            <span />
          ) : (
            <Button variant="ghost" onClick={onBack}>
              {t('modal.voltar')}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('modal.cancelar')}
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={!s.canSave || s.isSaving}
            >
              {t('modal.salvar')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
