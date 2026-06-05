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
import { Button } from '@/components/ui/button'
import type { ImportSelection } from '../../types'
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
  onClose: () => void
  onSaved: () => void
  onBack: () => void
}

export function ConfigurarImportacaoModal({
  open,
  selection,
  onClose,
  onSaved,
  onBack,
}: Props) {
  const s = useConfigurarImportacao(open, selection)
  const { flags } = s

  async function handleSave() {
    try {
      await s.handleSave()
      onSaved()
    } catch {
      // erro exibido via s.saveError
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
          <DialogTitle>Configurar importação</DialogTitle>
          <DialogDescription>
            Defina o destino no Bitrix24 e o de-para de colunas
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-4 border-b border-border px-6 py-5">
          <IdentidadeSection
            spreadsheet={s.spreadsheet}
            title={s.title}
            setTitle={s.setTitle}
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

          {(s.error ?? s.saveError) && (
            <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {s.saveError ?? s.error}
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
            fieldOptions={s.fieldOptions}
            setMapping={s.setMapping}
            toggleIdentifier={s.toggleIdentifier}
            excludeColumn={s.excludeColumn}
            setFeedColumn={s.setFeedColumn}
          />
        </DialogBody>

        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={onBack}>
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={!s.canSave || s.isSaving}
            >
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
