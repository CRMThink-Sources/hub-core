# Spec Delta

## Purpose

Define como a tela dos robôs "Enviar template" e "Enviar botões" grava e relê valores de campo da entidade no Bitrix, e como o servidor reage quando o Bitrix entrega ao robô um destino que não foi resolvido. Evita que abrir e salvar um robô estrague a configuração e que o operador fique sem saber por que "nenhum destinatário válido".

## ADDED Requirements

### Requirement: Campo da entidade é gravado em expressão que o Bitrix resolve sem sobras
Ao salvar um valor escolhido como "Campo da entidade", a tela do robô SHALL gravá-lo na expressão de campo de documento de **chave simples**, `{=Document:<ID>}`, de modo que o valor que chega ao servidor seja o conteúdo do campo, sem chaves ao redor. Valores digitados como "Texto" e tokens do seletor nativo do Bitrix SHALL ser gravados como estão.

O robô SHALL continuar reconhecendo como "Campo da entidade" os valores salvos antes desta regra, em forma de expressão com uma a três chaves.

#### Scenario: Nome do contato chega sem chaves
- **WHEN** o operador escolhe "Campo da entidade" → "Contato: Primeiro nome" para a variável do template e o robô dispara para o contato João
- **THEN** o texto enviado ao contato é "Olá, João!", sem chaves ao redor do nome

#### Scenario: Robô salvo no formato antigo continua reconhecido
- **WHEN** o operador abre um robô cujo valor foi salvo como expressão de chave dupla
- **THEN** o valor aparece como "Campo da entidade" do mesmo campo, e não como texto digitado

#### Scenario: Texto digitado não é alterado
- **WHEN** o operador grava um telefone digitado como "Texto"
- **THEN** o valor é gravado exatamente como digitado

### Requirement: Reabrir o robô não estraga um campo já configurado
Quando o Bitrix devolver um valor na forma de exibição `{{{Rótulo}}}` e o rótulo for **idêntico** ao título de **exatamente um** campo do documento da automação, a tela do robô SHALL abri-lo como "Campo da entidade" daquele campo. Salvar sem outra alteração SHALL gravar a expressão de chave simples desse campo.

Quando o rótulo não corresponder a nenhum campo, ou corresponder a mais de um, a tela SHALL manter o valor como "Seletor do Bitrix", sem alterá-lo. Tokens que apontam para o retorno de outro passo da automação, como `{{{[Passo] Nome}}}`, e que por isso não coincidem com o título de nenhum campo do documento, SHALL ser mantidos como estão.

Esta regra vale para todo valor que a tela guarda como campo: o destino, as variáveis do corpo, os valores de botão e a imagem do cabeçalho no robô de template, e o destino no robô de botões.

#### Scenario: Abrir e salvar mantém o campo resolvível
- **WHEN** o Bitrix devolve o destino como `{{{Contato: Celular}}}`, o documento tem um único campo com esse título, e o operador salva sem tocar no destino
- **THEN** o destino é gravado como expressão de campo e o próximo disparo entrega o telefone do contato

#### Scenario: Rótulo ambíguo é preservado
- **WHEN** dois campos do documento têm o mesmo título que o rótulo recebido
- **THEN** o valor continua como "Seletor do Bitrix" e é gravado como veio

#### Scenario: Retorno de outro passo é preservado
- **WHEN** o valor é `{{{[Criar usando fonte] ID Empresa}}}`
- **THEN** a tela o mostra como "Seletor do Bitrix" e o grava exatamente como está

#### Scenario: Lista de campos indisponível
- **WHEN** a lista de campos do documento não está disponível ao abrir o robô
- **THEN** o valor `{{{Rótulo}}}` é mantido como "Seletor do Bitrix", como antes

### Requirement: Destino não resolvido gera aviso com a causa provável
Quando o destino recebido pelo robô de template ou pelo robô de botões estiver vazio, for `{}` ou ainda contiver um token `{{…}}` ou `{{{…}}}` não resolvido, e nenhum outro destinatário for encontrado, o servidor SHALL registrar na timeline do CRM um aviso que diga o que chegou e o que fazer, em vez do aviso genérico de nenhum destinatário válido:

- destino vazio ou `{}`: o campo escolhido veio vazio no documento; o operador deve conferir se o contato tem telefone do tipo lido pelo campo (por exemplo "Celular");
- token `{{{…}}}` literal: o Bitrix não resolveu o campo; o operador deve reabrir o robô, escolher o campo de novo e salvar.

O aviso SHALL citar o valor recebido como chegou. Destino que é um telefone mal formado, mas não um destino vazio nem um token não resolvido, SHALL continuar recebendo o aviso de nenhum destinatário válido. O envio SHALL continuar recusado nesses casos: nenhum template ou mensagem é enfileirado.

#### Scenario: Campo vazio no contato
- **WHEN** o destino chega como `{}` porque o telefone do contato é de outro tipo
- **THEN** a timeline recebe o aviso de campo vazio, com a sugestão de conferir o tipo do telefone, e nada é enfileirado

#### Scenario: Token literal
- **WHEN** o destino chega como `{{{Contato: Celular}}}`
- **THEN** a timeline recebe o aviso de campo não resolvido, com a instrução de reabrir o robô, escolher o campo e salvar, e nada é enfileirado

#### Scenario: Telefone mal formado
- **WHEN** o destino chega como `1234`
- **THEN** a timeline recebe o aviso de nenhum destinatário válido, como hoje

#### Scenario: Há outro destinatário válido
- **WHEN** o envio para todos os contatos relacionados encontra um destinatário válido e outro vazio
- **THEN** o destinatário válido é enfileirado e o robô comenta o enfileiramento, sem o aviso de destino não resolvido
