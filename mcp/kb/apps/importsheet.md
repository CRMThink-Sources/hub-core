# App: ImportSheet

## O que faz
Integração que importa dados de uma planilha do **Google Sheets** para o
**Bitrix24** do cliente. Cada linha da planilha vira (ou atualiza) um registro no
CRM — lead, negócio, contato, empresa ou item de SPA. A importação pode rodar
**manualmente** (botão) ou **agendada** (roda sozinha de tempos em tempos).

## Fluxos principais
1. **Conexão Google**: o cliente conecta uma conta Google nas Configurações
   (fluxo OAuth em janela popup). A conta conectada é quem lê as planilhas — a
   planilha precisa estar compartilhada com essa conta.
2. **Configuração da importação**: o cliente escolhe a planilha e a aba, o destino
   no Bitrix24 (entidade + categoria), e monta o **de-para** — qual coluna da
   planilha vai pra qual campo do Bitrix24. Pode definir coluna de identificador
   (pra atualizar em vez de duplicar) e responsável.
3. **Execução**: o CRMThink lê as linhas da planilha em páginas, transforma os
   valores conforme o de-para e escreve no Bitrix24. Linhas com erro ficam
   guardadas e podem ser **reprocessadas** depois.
4. **Agendamento**: uma importação ativa roda sozinha no intervalo configurado; se
   estourar erro fatal, ela é **pausada** automaticamente.

## Modos de falha comuns
- **Conta Google desconectada / token revogado** → `importsheet.google.auth_required`
  (mais comum; resolve reconectando nas Configurações).
- **Planilha não compartilhada ou ID errado** → `importsheet.sheet.not_found_or_forbidden`.
- **Aba renomeada/excluída depois de configurar** → `importsheet.sheet.tab_deleted`.
- **Valor da célula não bate com a lista do Bitrix24** (lista/enum) → campo é
  **ignorado em silêncio** → `importsheet.import.status_no_match` /
  `importsheet.import.enum_no_match` (gera ticket "importou mas faltou campo").
- **Identificador casou com mais de um registro** → `importsheet.import.ambiguous_match`
  (linha não escrita).
- **Bitrix24 sobrecarregado** (limite de intensidade/orçamento) → o sistema pausa e
  retoma sozinho → `importsheet.bitrix.intensity_limit` / `operating_budget`.

## Dicas de triagem
- Erro de conexão Google é config do cliente (reconectar), não bug.
- "Importou mas faltaram campos" quase sempre é valor da planilha que não existe na
  lista do Bitrix24 — o campo é omitido sem quebrar a linha.
- Erro por-linha fica guardado na importação; o cliente vê no modal de erros e pode
  **reprocessar** só as linhas que falharam.
- Sempre peça o `traceKey` da tela de Logs pra localizar a execução exata.
- Diferencie **falha na configuração** (ao montar a importação, tela trava) de
  **falha na execução** (importação roda e registra erro por-linha ou fatal).
