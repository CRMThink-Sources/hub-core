---
category: auth
audience: suporte
summary: O código de segurança do webhook da Clicksign não conferiu e o evento foi recusado.
---
# clicksign.webhook.signature_invalid

## O que significa
Toda vez que algo acontece com um documento (assinado, recusado, cancelado), a
Clicksign manda um aviso automático pro CRMThink — isso é o *webhook*. Junto do
aviso vem um código de segurança, que serve pra provar que o aviso veio mesmo da
Clicksign, e não de um impostor tentando se passar por ela.

Esse erro quer dizer que o código de segurança não conferiu. O CRMThink então
recusa o aviso por precaução, e o documento fica parado — não avança pro próximo
passo no Bitrix24.

## Causa provável
- **Segredo diferente entre os dois lados** (mais comum): o "segredo do webhook" é
  uma senha que a Clicksign e o CRMThink precisam ter idêntica pra gerar e conferir
  o código. Se alguém trocou o segredo em um lado só, para de bater.
- **Segredo colado com sujeira**: um espaço ou quebra de linha a mais na hora de
  copiar já quebra a conferência.
- **Ambiente errado**: o webhook da conta de teste apontando pro ambiente de
  produção (ou o contrário).

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: clicksign.webhook.signature_invalid`
   — assim você tem certeza que é este caso, e não outro erro de webhook.
3. Veja o campo `domain` na mesma linha pra saber de qual parceiro é o problema.

## Como resolver
1. Oriente o parceiro a abrir o painel da Clicksign e copiar de novo o segredo do
   webhook. Copiar de novo evita o problema de segredo desatualizado ou com sujeira.
2. Peça que ele cole esse segredo nas Configurações da integração Clicksign no
   CRMThink, **sem espaços nas pontas**, e salve. Isso deixa os dois lados com o
   segredo idêntico.
3. Peça um novo evento de teste (ou aguarde o próximo) e confirme na tela de Logs
   que o erro não aparece mais.

## Quando escalar
Se o parceiro confirmou que o segredo é o mesmo nos dois lados e o erro continua, o
problema não é de configuração — acione a equipe de desenvolvimento. Anexe:
`traceKey`, `código de erro: clicksign.webhook.signature_invalid`, domínio do parceiro e o horário do evento.
