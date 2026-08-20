---
category: integration
audience: suporte
summary: Falha ao criar ou atualizar a instância de telefonia, então o provisionamento não concluiu.
---
# sonax.instance.provisioning_failed

## O que significa
O provisionamento é o processo que cria ou atualiza a instância de telefonia do parceiro, ligando o SonaVoip ao Bitrix24 dele.

Esse erro quer dizer que esse processo foi tentado, mas não conseguiu concluir a criação ou atualização da instância. Como muitas vezes é uma falha momentânea, geralmente vale tentar novamente.

## Causa provável
- **Instabilidade momentânea**: algum serviço envolvido no provisionamento estava indisponível no momento.
- **Dados de configuração incompletos ou inconsistentes**: falta algum dado necessário para concluir a instância.
- **Falha temporária na comunicação** com o SonaVoip ou com o Bitrix24 durante o processo.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.instance.provisioning_failed`.
3. Verifique se o erro é pontual ou está se repetindo a cada tentativa de provisionamento.

## Como resolver
1. Aguarde alguns minutos e peça ao parceiro para tentar o provisionamento novamente pela tela do Sonax.
2. Confira nas Configurações do Sonax se todos os dados obrigatórios estão preenchidos.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o provisionamento continua falhando após novas tentativas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.instance.provisioning_failed`, domínio do parceiro e o horário do evento.
