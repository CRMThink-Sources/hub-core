# Proposal

## Why

Template com cabeçalho de imagem exige, em cada envio pelo widget do CRM, uma URL pública `https` que aponte direto para o arquivo. O operador do contact center raramente tem isso à mão: cola link do Drive (página, não arquivo), link copiado do WhatsApp/Meta ou link de rede social, e o envio falha na Meta depois de aceito. Com um bucket Cloudflare R2 já criado em staging, o ThinkZap pode receber o arquivo e gerar ele mesmo a URL pública.

## What Changes

- **Widget do CRM**: em template com cabeçalho de imagem, o operador escolhe entre **enviar um arquivo** (JPEG/PNG, até 5 MB) e **informar um link**, como hoje. O arquivo sobe assim que é escolhido, e o preview mostra a imagem já hospedada.
- **API**: nova rota de upload da imagem do cabeçalho para o widget. Valida o arquivo pelo conteúdo e pelo tamanho, grava no bucket R2 com nome impossível de adivinhar e devolve a URL pública. O envio do template continua igual: o widget manda essa URL em `headerImageUrl`, e fila, reprocessamento e adapter não mudam.
- **Retenção**: os arquivos expiram em **30 dias** por regra de ciclo de vida do próprio bucket. Não há job de limpeza.
- **Disponibilidade**: sem as variáveis do R2 no ambiente, a opção de arquivo não aparece e o widget segue só com link.
- Fica de fora: upload no robô de template do Bitrix24 (continua URL ou campo do documento), upload na campanha SMS, vídeo/documento e o uso do bucket na **criação** do template (ver design, "Open Questions").

## Capabilities

### New Capabilities
- `thinkzap/upload-imagem-envio-widget`: upload da imagem do cabeçalho pelo widget do CRM, hospedagem temporária no bucket e uso da URL gerada no envio do template.

### Modified Capabilities
<!-- Nenhuma em `openspec/specs/`. O requisito "Widget pede a imagem do cabeçalho" pertence a `thinkzap/imagem-template-oficial`, que ainda está na mudança `imagem-cabecalho-template-oficial` (não arquivada). Esta mudança acrescenta o caminho por arquivo sem alterar o caminho por link. -->

## Impact

- **API** (`api/src/modules/thinkzap`): rota nova de upload no widget (multer em memória, 5 MB), port de armazenamento no domínio e adapter R2 na infra (`@aws-sdk/client-s3`, compatível com R2), reaproveitando `sniffTemplateImageType` e `TEMPLATE_SAMPLE_IMAGE_MAX_BYTES`; catálogo do widget informa se o upload está disponível; códigos novos no catálogo de erros com runbooks.
- **Configuração**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` em `env.ts` (já preenchidas em staging; produção pendente).
- **Front**: `template-composer.tsx` e `conversation-view.tsx` (opção arquivo/link, upload, preview), `use-widget-templates.ts` (flag de disponibilidade).
- **Dependência nova**: `@aws-sdk/client-s3`.
- **Externo**: Cloudflare R2 (custo estimado próximo de zero no volume previsto; regra de expiração de 30 dias e acesso público configurados no bucket). Depende de a mudança `imagem-cabecalho-template-oficial` estar implementada (campo `headerImageUrl` no envio).
