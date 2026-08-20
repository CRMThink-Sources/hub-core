# App: ImportSheet

## O que é (nível suporte)
Integração que importa dados de uma planilha do **Google Sheets** para o
**Bitrix24** do cliente. Cada linha da planilha vira (ou atualiza) um registro no
CRM. A importação pode rodar **manualmente** (botão) ou **agendada**.

> Este contexto é apoio interno de triagem. Não descreva arquitetura, fluxo
> interno ou "como funciona por dentro" para o solicitante — só use para
> identificar o modo de falha e guiar a resolução do erro.

## Modos de falha comuns (para triar)
- **Conta Google desconectada / token revogado** → `importsheet.google.auth_required`
  (mais comum; resolve reconectando nas Configurações).
- **Planilha não compartilhada ou ID errado** → `importsheet.sheet.not_found_or_forbidden`.
- **Aba renomeada/excluída depois de configurar** → `importsheet.sheet.tab_deleted`.
- **Valor da célula não bate com a lista do Bitrix24** → campo é **ignorado em
  silêncio** → `importsheet.import.status_no_match` / `importsheet.import.enum_no_match`
  (gera ticket "importou mas faltou campo").
- **Identificador casou com mais de um registro** → `importsheet.import.ambiguous_match`
  (linha não escrita).
- **Bitrix24 sobrecarregado** (limite de intensidade/orçamento) → pausa e retoma
  sozinho → `importsheet.bitrix.intensity_limit` / `operating_budget`.

## Dicas de triagem
- Erro de conexão Google é config do cliente (reconectar), não bug.
- "Importou mas faltaram campos" quase sempre é valor da planilha que não existe na
  lista do Bitrix24 — o campo é omitido sem quebrar a linha.
- Erro por-linha fica guardado na importação; o cliente vê no modal de erros e pode
  **reprocessar** só as linhas que falharam.
- Diferencie **falha na configuração** (ao montar a importação, tela trava) de
  **falha na execução** (importação roda e registra erro por-linha ou fatal).
- Sempre peça o `traceKey` da tela de Logs para localizar a execução exata.
