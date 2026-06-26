export interface CardSigner {
  signerKey: string
  name: string
  email: string
}

interface BuildActivityCardInput {
  dealId: string | number
  documentId: string
  envelopeKey: string
  groupId: string
  signers: CardSigner[]
  selfUrl?: string
  apiToken: string
  activityId?: string | number
}

export function buildActivityCard(
  input: BuildActivityCardInput,
): Record<string, unknown> {
  const {
    dealId,
    documentId,
    envelopeKey,
    groupId,
    signers,
    selfUrl,
    apiToken,
  } = input

  const originId: Record<string, unknown> = { group: groupId, envelopeKey }
  for (const signer of signers) {
    originId[signer.signerKey] = false
  }
  const originIdJson = JSON.stringify(originId)

  const blocks: Record<string, unknown> = {
    text: {
      type: 'withTitle',
      properties: {
        title: '[Clicksign]',
        block: {
          type: 'text',
          properties: {
            multiline: true,
            value: 'Documento enviado para assinatura\nSignatários',
          },
        },
      },
    },
  }
  for (const signer of signers) {
    blocks[signer.signerKey] = {
      type: 'text',
      properties: {
        value: `${signer.name} - ${signer.email} - Aguardando`,
        color: 'base_90',
      },
    }
  }

  const actionParams: Record<string, unknown> = {
    documentKey: documentId,
    dealId,
    apiToken,
    originId: originIdJson,
    logoUri: selfUrl,
  }
  if (input.activityId != null) actionParams.activityId = input.activityId

  const body: Record<string, unknown> = {
    ownerTypeId: 2,
    ownerId: dealId,
    fields: {
      TYPE_ID: 2,
      // O webhook acha a activity por `%SUBJECT = document.key`.
      SUBJECT: documentId,
      originId: originIdJson,
    },
    layout: {
      icon: { code: 'clicksign' },
      header: {
        title: `Documento ${documentId} - ${groupId}`,
        tags: {
          status: { type: 'warning', title: 'Em andamento' },
        },
      },
      body: {
        logo: {
          code: 'clicksign',
          action: selfUrl ? { type: 'redirect', uri: selfUrl } : undefined,
        },
        blocks,
      },
      footer: {
        buttons: {
          cancelButton: {
            title: 'Cancelar documento',
            type: 'secondary',
            action: {
              type: 'restEvent',
              id: 'cancelDocument',
              animationType: 'disable',
              actionParams,
            },
          },
        },
        menu: { showPostponeItem: 'false', items: {} },
      },
    },
  }
  if (input.activityId != null) body.id = input.activityId

  return body
}

export function buildCancelActivityCard(input: {
  activityId: string | number
  dealId: string | number
  documentKey: string
  originId: string
  logoUri?: string
}): Record<string, unknown> {
  return {
    id: input.activityId,
    ownerTypeId: 2,
    ownerId: input.dealId,
    fields: {
      TYPE_ID: 2,
      originId: input.originId,
    },
    layout: {
      icon: { code: 'document' },
      header: {
        title: `Documento ${input.documentKey}`,
        tags: {
          status: { type: 'failure', title: 'Cancelado' },
        },
      },
      body: {
        logo: {
          code: 'document',
          action: input.logoUri
            ? { type: 'redirect', uri: input.logoUri }
            : undefined,
        },
        blocks: {},
      },
      footer: {
        buttons: {},
        menu: { showPostponeItem: 'false', items: {} },
      },
    },
  }
}
