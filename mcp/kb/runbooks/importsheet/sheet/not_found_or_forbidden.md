---
category: integration
audience: suporte
summary: Ao configurar a importação, a planilha não foi encontrada ou a conta Google conectada não tem acesso a ela.
---
# importsheet.sheet.not_found_or_forbidden

## O que significa
Para importar os dados, o CRMThink usa a conta Google que o cliente conectou nas
Configurações. É essa conta que abre e lê a planilha. Para conseguir ler, a conta
conectada precisa ter acesso à planilha — ou seja, a planilha precisa estar
compartilhada com o e-mail dessa conta.

Esse erro aparece quando o cliente está configurando ou testando a importação e o
Google respondeu que a planilha não existe (no endereço informado) ou que a conta
conectada não tem permissão para abri-la. Enquanto isso não for resolvido, a
importação não consegue ser salva nem executada.

## Causa provável
- **Planilha não compartilhada com a conta conectada** (mais comum): a planilha
  existe, mas ninguém deu acesso ao e-mail da conta Google que está conectada no
  CRMThink.
- **ID ou link da planilha errado**: o endereço colado na configuração aponta para
  uma planilha que não existe ou foi digitado incorretamente.
- **Conta conectada diferente da dona da planilha**: a planilha pertence a uma conta
  Google, mas o cliente conectou outra conta no CRMThink, que não tem acesso.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `errorCode: importsheet.sheet.not_found_or_forbidden`.
3. Nas Configurações da integração, veja qual é o e-mail da conta Google que está
   conectada — é esse e-mail que precisa ter acesso à planilha.

## Como resolver
1. Oriente o parceiro a conferir o ID/link da planilha usado na configuração da
   importação, comparando com o endereço que aparece na barra do navegador quando a
   planilha está aberta. Corrigir o endereço resolve os casos de link errado.
2. Oriente o parceiro a abrir a planilha no Google Sheets, usar o botão de
   compartilhar e adicionar o e-mail da conta Google conectada no CRMThink, com
   permissão de leitura. Assim a conta conectada passa a enxergar a planilha.
3. Se a planilha pertence a outra conta e não pode ser compartilhada, oriente o
   parceiro a reconectar o CRMThink usando a conta Google dona da planilha, nas
   Configurações.
4. Peça para salvar a configuração e testar de novo, confirmando na tela de Logs que
   o erro não aparece mais.

## Quando escalar
Se o parceiro confirmou que o link está correto e que a planilha está compartilhada
com o e-mail da conta conectada, e o erro continua, acione a equipe de
desenvolvimento. Anexe: `traceKey`, `errorCode: importsheet.sheet.not_found_or_forbidden`, domínio do parceiro, id da importação e horário.
