# thinkzap/idioma-avisos-servidor Specification

## Purpose

Garante que os avisos que o servidor do ThinkZap gera sem tela aberta saiam no idioma escolhido no app para a instalação (português, inglês ou espanhol). Vale para o chat do canal aberto, a timeline do CRM, o sininho do Bitrix e o histórico da conversa.

## Requirements

### Requirement: Idioma do aviso é o da instalação
Todo aviso listado nesta capability SHALL sair no idioma gravado para a instalação, entre `pt`, `en` e `es`. É o idioma escolhido por último no menu do ThinkZap, por qualquer usuário da instalação.

Instalação sem idioma gravado, com valor fora dos três ou cujo idioma não pôde ser lido SHALL receber o aviso em português. A falha ao ler o idioma SHALL NOT impedir nem atrasar o envio do aviso.

Os três idiomas SHALL ter texto para todo aviso. Um aviso sem texto num idioma SHALL ser tratado como defeito, e não cair em silêncio para outro idioma.

Os textos SHALL manter, nos três idiomas, os mesmos dados do aviso em português: destinatário, mensagem, template, telefone, quantidade, instância e motivo.

#### Scenario: Instalação em inglês
- **WHEN** o idioma da instalação é `en` e o servidor gera um aviso desta capability
- **THEN** o aviso sai em inglês

#### Scenario: Instalação em espanhol
- **WHEN** o idioma da instalação é `es` e o servidor gera um aviso desta capability
- **THEN** o aviso sai em espanhol

#### Scenario: Instalação sem idioma escolhido
- **WHEN** ninguém da instalação trocou o idioma no menu do ThinkZap
- **THEN** o aviso sai em português, como antes desta change

#### Scenario: Idioma ilegível
- **WHEN** a leitura do idioma da instalação falha
- **THEN** o aviso sai em português e é enviado normalmente

### Requirement: Avisos do chat do canal aberto
Os avisos que o servidor posta no chat do canal aberto para o operador SHALL seguir o idioma da instalação:

- o aviso de janela de 24h fechada da linha oficial;
- o aviso de falha no envio de botões pela tela do canal aberto. A parte fixa do texto é traduzida; o motivo vindo da validação de botões SHALL aparecer como veio;
- o aviso de recusa da Meta depois do aceite, em todas as variantes: por código da Meta, por texto reconhecido, sem motivo informado e a genérica. Na variante genérica, o retorno do provedor SHALL aparecer como veio;
- o resumo do bot na transferência: o título e o texto de "cliente não respondeu nada". Os rótulos definidos pelo autor do fluxo e as respostas do contato SHALL aparecer como foram escritos.

#### Scenario: Janela de 24h fechada em inglês
- **WHEN** a instalação está em `en` e o operador responde um contato fora da janela de 24h numa linha oficial
- **THEN** o aviso de janela fechada no chat sai em inglês

#### Scenario: Recusa da Meta por código em espanhol
- **WHEN** a instalação está em `es` e a Meta recusa uma mensagem com o código 131026
- **THEN** o aviso no chat sai em espanhol, com o motivo de número sem WhatsApp

#### Scenario: Recusa genérica preserva o retorno do provedor
- **WHEN** a instalação está em `en` e a Meta recusa com um código sem variante própria
- **THEN** a parte fixa do aviso sai em inglês e o retorno do provedor aparece como veio

#### Scenario: Resumo do bot com rótulos do autor
- **WHEN** a instalação está em `en` e o bot transfere uma conversa em que coletou "Nome: Maria"
- **THEN** o título do resumo sai em inglês e a linha "Nome: Maria" aparece como foi escrita

### Requirement: Avisos na timeline do CRM
Os comentários que o servidor publica na timeline do CRM SHALL seguir o idioma da instalação:

- falha e entrega incerta do envio pelo widget;
- confirmação de envio pelo widget, pela fila e no envio síncrono com anexo, incluindo os rótulos de remetente, destinatário, mensagem e template;
- resultado do robô "Enviar mensagem" e o aviso de nenhum destinatário;
- todos os comentários do robô de botões e do robô de template: configuração incompleta, linha que não pode enviar, linha de provider diferente do robô, nenhum destinatário, nenhum destinatário válido e enfileirado para.

O conteúdo da mensagem, o nome do template, os telefones e mensagens de erro vindas da validação SHALL aparecer como vieram.

#### Scenario: Falha no envio pelo widget em inglês
- **WHEN** a instalação está em `en` e uma mensagem do widget falha de forma definitiva
- **THEN** o comentário na timeline sai em inglês, com destinatário e mensagem como foram enviados

#### Scenario: Robô de template em espanhol
- **WHEN** a instalação está em `es` e o robô de template enfileira um template para dois contatos
- **THEN** o comentário na timeline sai em espanhol, com o nome do template e os telefones como estão

### Requirement: Notificações no sininho do Bitrix
As notificações de linha conectada e desconectada enviadas aos destinatários configurados SHALL seguir o idioma da instalação. O motivo da desconexão vindo do provedor SHALL aparecer como veio.

#### Scenario: Linha desconectada em inglês
- **WHEN** a instalação está em `en` e uma linha Z-API se desconecta
- **THEN** os destinatários recebem no sininho a notificação de desconexão em inglês

### Requirement: Textos no histórico do canal aberto
Os textos que o servidor acrescenta ao histórico do canal aberto ao espelhar um envio feito pelo CRM SHALL seguir o idioma da instalação:

- o prefixo que identifica a mensagem como enviada a partir do CRM;
- os marcadores de envio só com anexo: imagem, vídeo, áudio e arquivo.

A mensagem digitada pelo operador SHALL aparecer como foi escrita.

#### Scenario: Envio pelo CRM espelhado em inglês
- **WHEN** a instalação está em `en` e o operador envia uma mensagem pelo widget com o espelho no canal aberto ligado
- **THEN** o histórico do canal aberto mostra o prefixo em inglês seguido da mensagem como foi escrita

#### Scenario: Envio só com imagem em espanhol
- **WHEN** a instalação está em `es` e o operador envia só uma imagem pelo widget
- **THEN** o histórico mostra o marcador de imagem enviada em espanhol
