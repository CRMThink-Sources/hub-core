---
category: auth
audience: suporte
summary: A conta Google está desconectada ou o acesso foi revogado, e a importação não consegue ler a planilha.
---
# importsheet.google.auth_required

## O que significa
Para ler os dados da planilha, o ImportSheet precisa de uma conta Google conectada
e autorizada. É essa conta conectada que abre a planilha em nome do cliente — a
planilha precisa estar compartilhada com ela.

Esse erro quer dizer que essa conexão não está mais valendo: ou nunca foi feita, ou
o Google deixou de aceitar o acesso. Sem uma conta válida, a importação não
consegue nem abrir a planilha, então ela para antes de importar qualquer linha.

## Causa provável
- **Nenhuma conta Google foi conectada ainda** (mais comum quando é a primeira
  importação do parceiro).
- **O cliente revogou o acesso** direto na conta Google dele (na tela de
  aplicativos com acesso à conta).
- **O acesso expirou** com o tempo e não pôde ser renovado automaticamente.
- **O Google recusa o acesso repetidamente** (respostas de "não autorizado"
  seguidas), o que também derruba a conexão.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.google.auth_required`.
3. Abra as Configurações do ImportSheet do parceiro e veja o estado da conta
   Google — quando o sistema detecta esse caso, a própria tela mostra um atalho
   para reconectar.

## Como resolver
1. Oriente o parceiro a abrir as **Configurações do ImportSheet** e usar a opção de
   **reconectar a conta Google**. Isso abre um popup do próprio Google.
2. Peça que ele escolha, nesse popup, a **conta que tem acesso às planilhas** e
   conclua a autorização. Escolher a conta certa garante que ela consiga abrir a
   planilha usada na importação.
3. Depois de reconectar, peça para rodar a importação de novo e confirme na tela de
   Logs que o erro não aparece mais.

## Quando escalar
Se o parceiro reconectou a conta Google (com a conta correta) e o erro continua
aparecendo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: importsheet.google.auth_required`, domínio do
parceiro, id da importação e horário.
