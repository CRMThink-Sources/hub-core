---
category: auth
audience: suporte
summary: A janela de conexão com o Google expirou ou foi reaberta antes de terminar, e a conexão não se completou.
---
# importsheet.oauth.state_invalid_or_expired

## O que significa
Quando o parceiro conecta a conta Google, abre um popup do Google para ele escolher
a conta e autorizar. Essa janela tem um tempo limitado para ser concluída (por
volta de 10 minutos) e precisa ser terminada na mesma tentativa em que foi aberta.

Esse erro quer dizer que a janela não foi concluída a tempo, ou foi reaberta no meio
do caminho. Como o processo perdeu a referência de qual conexão estava sendo feita,
o Google não é aceito e a conta acaba não conectando.

## Causa provável
- **O popup ficou aberto tempo demais** antes de o parceiro concluir (passou da
  validade de ~10 minutos).
- **O popup foi fechado e reaberto** no meio do processo.
- **O botão de conectar foi clicado duas vezes**, abrindo duas janelas que se
  atrapalham.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `errorCode: importsheet.oauth.state_invalid_or_expired`.
3. Pergunte ao parceiro se a janela do Google ficou muito tempo aberta ou foi
   reaberta — isso costuma confirmar o caso.

## Como resolver
1. Oriente o parceiro a **fechar qualquer janela do Google** que tenha ficado aberta.
2. Peça que ele volte às **Configurações do ImportSheet** e **inicie a conexão de
   novo**, do zero.
3. Oriente a **concluir sem demora**: escolher a conta e autorizar logo que a janela
   abrir, sem deixá-la parada e sem clicar duas vezes no botão.

## Quando escalar
Se o parceiro refez a conexão do começo, sem demora, e o erro continua, acione a
equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: importsheet.oauth.state_invalid_or_expired`, domínio do parceiro, id da importação
e horário.
