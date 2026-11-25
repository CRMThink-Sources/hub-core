# Spec Delta

## Purpose

Permite usar na API Oficial um número que continua no app WhatsApp Business, mantendo no canal aberto do Bitrix24 o que é enviado pelo celular e pelo Bitrix24.

## ADDED Requirements

### Requirement: Conexão em coexistência
Ao conectar uma linha oficial, o sistema SHALL informar à HubMessage o modo de coexistência indicado pelo fluxo de autenticação da Meta: verdadeiro quando o número entrou em coexistência e falso nos demais casos. Uma conexão em coexistência SHALL ser aceita sem identificador de telefone no retorno. Fora da coexistência, retorno sem identificador de telefone SHALL continuar sendo tratado como incompleto. Chamada que não informe o modo SHALL ser tratada como sem coexistência.

#### Scenario: Número em coexistência
- **WHEN** o cliente conclui a autenticação com um número do app WhatsApp Business
- **THEN** a linha é conectada informando coexistência à HubMessage

#### Scenario: Número só na API
- **WHEN** o cliente conclui a autenticação com um número que não usa o app
- **THEN** a linha é conectada informando que não há coexistência

#### Scenario: Coexistência sem id do telefone
- **WHEN** o retorno de uma conexão em coexistência traz a conta e o código, sem id do telefone
- **THEN** a conexão prossegue

#### Scenario: Retorno incompleto fora da coexistência
- **WHEN** o retorno sem coexistência não traz o id do telefone
- **THEN** a tela informa que o retorno veio incompleto e nada é conectado

### Requirement: Avisos antes de conectar
A aba de conexão de uma linha oficial desconectada SHALL informar, no idioma da instalação (pt, en ou es), que para manter um número no app WhatsApp Business: nem todo número é elegível pela Meta; o app precisa ser aberto ao menos uma vez a cada 15 dias; o WhatsApp Desktop para Windows não funciona; e o WhatsApp Web é desconectado, podendo ser reconectado.

#### Scenario: Linha desconectada
- **WHEN** o administrador abre a aba de conexão de uma linha oficial desconectada
- **THEN** os quatro avisos aparecem junto do botão de conectar

### Requirement: Mensagens do app no canal aberto
Toda mensagem enviada pela empresa que não saiu pela integração SHALL ser publicada no canal aberto da linha, com um aviso de que foi enviada pelo WhatsApp do aparelho, no idioma da instalação. Mensagens enviadas pela integração (Bitrix24, widget e robôs) NÃO SHALL ser publicadas de novo. Quando a origem da mensagem não puder ser determinada, o sistema NÃO SHALL publicá-la. Texto, mídia e contatos suportados no recebimento SHALL ser publicados. Linha sem assinatura ativa ou sem canal aberto vinculado NÃO SHALL publicar. Todo descarte SHALL ficar registrado com o motivo.

#### Scenario: Resposta pelo celular
- **WHEN** o atendente responde pelo app a um contato que tem conversa no canal aberto
- **THEN** a resposta aparece nessa conversa com o aviso de enviada pelo aparelho

#### Scenario: Contato sem conversa
- **WHEN** uma mensagem é enviada pelo app a um contato sem conversa no canal aberto
- **THEN** uma conversa é aberta com essa mensagem, e a resposta do contato cai nela

#### Scenario: Envio pelo Bitrix24
- **WHEN** o operador responde pelo Bitrix24
- **THEN** a mensagem aparece uma única vez

#### Scenario: Reentrega do evento
- **WHEN** a HubMessage entrega duas vezes o evento da mesma mensagem
- **THEN** ela é publicada uma única vez

#### Scenario: Linha inativa
- **WHEN** chega uma mensagem do app para uma linha sem assinatura ativa
- **THEN** ela não é publicada e o motivo fica registrado

### Requirement: Autor da mensagem espelhada
A mensagem espelhada de texto SHALL aparecer como o último operador que respondeu na conversa, quando houver um e ele tiver autorizado o aplicativo. Sem operador conhecido, sem autorização válida, em conversa nova, em mídia ou quando o Bitrix24 recusar, ela SHALL aparecer do lado do contato, mantendo o aviso de origem.

#### Scenario: Operador conhecido
- **WHEN** há um operador autorizado que respondeu por último e chega um texto enviado pelo app
- **THEN** a mensagem aparece como esse operador

#### Scenario: Sem operador
- **WHEN** a conversa não tem operador conhecido
- **THEN** a mensagem aparece do lado do contato, com o aviso

### Requirement: Sem reenvio e sem resposta automática
Uma mensagem espelhada NÃO SHALL ser enviada ao WhatsApp e NÃO SHALL ser tratada por fluxo de bot do ThinkZap como mensagem do contato.

#### Scenario: Cópia como operador
- **WHEN** a cópia é publicada como operador
- **THEN** o contato não recebe a mensagem uma segunda vez

#### Scenario: Linha com fluxo de bot
- **WHEN** uma mensagem do app é publicada do lado do contato numa conversa atendida por fluxo de bot
- **THEN** o bot não responde a ela
