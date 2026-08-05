---
category: config
audience: suporte
summary: Não há configuração do Sonax salva neste portal, então não há credenciais/parâmetros para operar.
---
# sonax.config.not_found

## O que significa
Para operar a telefonia, o Sonax precisa de uma configuração salva no portal do parceiro — é ali que ficam os dados de acesso e os parâmetros usados para registrar chamadas e integrar com o SonaVoip.

Esse erro quer dizer que a operação foi solicitada, mas não existe nenhuma configuração do Sonax salva nesse portal. Sem esses dados, o CRMThink não tem como seguir em frente.

## Causa provável
- **App instalado, mas nunca configurado**: o Sonax está no portal, porém o parceiro nunca abriu as Configurações e salvou os dados.
- **Configuração deixada pela metade**: o parceiro começou a preencher e não terminou.
- **Configuração removida**: os dados existiam, mas foram apagados depois (reinstalação ou engano).

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.config.not_found`.
3. Verifique, para o domínio do parceiro, se existe alguma configuração do Sonax salva. A ausência dela confirma a causa.

## Como resolver
1. Oriente o parceiro a abrir a tela de Configurações do Sonax no portal dele.
2. Peça que ele preencha e salve todos os dados obrigatórios da integração.
3. Peça ao parceiro para repetir a ação que gerou o erro e acompanhe na tela de Logs se ele deixa de ocorrer.

## Quando escalar
Se a configuração já está salva corretamente e o erro continua aparecendo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.config.not_found`, domínio do parceiro e o horário do evento.
