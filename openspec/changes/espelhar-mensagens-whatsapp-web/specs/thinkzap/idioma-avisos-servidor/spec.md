# Spec Delta

## MODIFIED Requirements

### Requirement: Textos no histórico do canal aberto
Os textos que o servidor acrescenta ao histórico do canal aberto ao espelhar um envio feito pelo CRM ou pelo aparelho da linha SHALL seguir o idioma da instalação:

- o prefixo que identifica a mensagem como enviada a partir do CRM;
- o prefixo que identifica a mensagem como enviada pelo WhatsApp do aparelho (celular ou WhatsApp Web) da linha não oficial;
- os marcadores de envio só com anexo: imagem, vídeo, áudio e arquivo.

A mensagem digitada pelo operador ou pelo cliente no aparelho SHALL aparecer como foi escrita.

#### Scenario: Envio pelo CRM espelhado em inglês
- **WHEN** a instalação está em `en` e o operador envia uma mensagem pelo widget com o espelho no canal aberto ligado
- **THEN** o histórico do canal aberto mostra o prefixo em inglês seguido da mensagem como foi escrita

#### Scenario: Envio só com imagem em espanhol
- **WHEN** a instalação está em `es` e o operador envia só uma imagem pelo widget
- **THEN** o histórico mostra o marcador de imagem enviada em espanhol

#### Scenario: Envio pelo aparelho espelhado em espanhol
- **WHEN** a instalação está em `es` e o cliente envia pelo WhatsApp Web uma mensagem a um contato com conversa no canal aberto
- **THEN** o histórico mostra o prefixo de mensagem enviada pelo aparelho em espanhol, seguido da mensagem como foi escrita
