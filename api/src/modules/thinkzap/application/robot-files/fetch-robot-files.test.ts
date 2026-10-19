import { describe, expect, it, vi } from 'vitest'
import {
  crmEntityTypeIdOf,
  fetchRobotFiles,
  fileNameFromDisposition,
  ROBOT_FILE_MAX_BYTES,
  RobotFileTooLargeError,
} from './fetch-robot-files'

const deal = { entity: 'DEAL', entityId: '39802' }

// Forma devolvida por `crm.item.get` para um campo de arquivo múltiplo (homolog).
const itemWithFiles = {
  result: {
    item: {
      id: 39802,
      title: 'Negócio #39802',
      ufCrm_1564159921839: [
        { id: 422204, url: 'https://x/ajax', urlMachine: 'https://x/m/422204' },
        { id: 422206, url: 'https://x/ajax', urlMachine: 'https://x/m/422206' },
      ],
      ufCrm_Single: { id: 500, urlMachine: 'https://x/m/500' },
    },
  },
}

const png = (name: string) => ({
  data: Buffer.from('png-bytes'),
  contentType: 'image/png',
  contentDisposition: `attachment; filename="x.png"; filename*=utf-8''${encodeURIComponent(name)}`,
})

const makeDeps = (
  download = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('422204')) return Promise.resolve(png('Captura 1.png'))
    if (url.endsWith('422206')) return Promise.resolve(png('Captura 2.png'))
    if (url.endsWith('500')) {
      return Promise.resolve({
        data: Buffer.from('%PDF'),
        contentType: 'application/pdf',
        contentDisposition: 'attachment; filename="boleto.pdf"',
      })
    }
    return Promise.reject(new Error('unexpected'))
  }),
) => ({
  getCrmItem: vi.fn().mockResolvedValue(itemWithFiles),
  download,
})

describe('fetchRobotFiles', () => {
  it('finds the ids in the document file fields and downloads each one', async () => {
    const deps = makeDeps()

    const results = await fetchRobotFiles(deps, deal, ['422204', '422206'])

    expect(deps.getCrmItem).toHaveBeenCalledTimes(1)
    expect(deps.getCrmItem).toHaveBeenCalledWith(2, '39802')
    expect(deps.download).toHaveBeenCalledWith(
      'https://x/m/422204',
      ROBOT_FILE_MAX_BYTES,
    )
    expect(results).toEqual([
      {
        status: 'ok',
        id: '422204',
        name: 'Captura 1.png',
        mime: 'image/png',
        kind: 'image',
        dataUrl: `data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`,
      },
      expect.objectContaining({ id: '422206', name: 'Captura 2.png' }),
    ])
  })

  it('reads single-value file fields and classifies by the downloaded type', async () => {
    const results = await fetchRobotFiles(makeDeps(), deal, ['500'])

    expect(results[0]).toMatchObject({
      status: 'ok',
      name: 'boleto.pdf',
      kind: 'document',
      mime: 'application/pdf',
    })
  })

  it('marks an id that is not in the document as unavailable (file set in the robot settings)', async () => {
    const deps = makeDeps()

    const results = await fetchRobotFiles(deps, deal, ['422204', '999'])

    expect(results[1]).toEqual({
      status: 'failed',
      id: '999',
      name: '#999',
      reason: 'unavailable',
    })
    expect(deps.download).toHaveBeenCalledTimes(1)
  })

  it('marks every file unavailable when the workflow has no CRM document', async () => {
    const deps = makeDeps()

    const results = await fetchRobotFiles(deps, null, ['422204'])

    expect(deps.getCrmItem).not.toHaveBeenCalled()
    expect(results).toEqual([
      expect.objectContaining({ id: '422204', reason: 'unavailable' }),
    ])
  })

  it('marks every file unavailable when the CRM item cannot be read', async () => {
    const deps = makeDeps()
    deps.getCrmItem.mockRejectedValue(new Error('Failed to get CRM item'))

    const results = await fetchRobotFiles(deps, deal, ['422204', '422206'])

    expect(results.map(r => r.status)).toEqual(['failed', 'failed'])
    expect(deps.download).not.toHaveBeenCalled()
  })

  it('marks a failed download as unavailable and keeps the other files', async () => {
    const download = vi
      .fn()
      .mockRejectedValueOnce(new Error('Request failed with status code 404'))
      .mockResolvedValueOnce(png('Captura 2.png'))

    const results = await fetchRobotFiles(makeDeps(download), deal, [
      '422204',
      '422206',
    ])

    expect(results[0]).toMatchObject({
      status: 'failed',
      reason: 'unavailable',
    })
    expect(results[1]).toMatchObject({ status: 'ok', name: 'Captura 2.png' })
  })

  it('marks a file over 30 MB as too large', async () => {
    const download = vi.fn().mockRejectedValue(new RobotFileTooLargeError())

    const results = await fetchRobotFiles(makeDeps(download), deal, ['422204'])

    expect(results[0]).toEqual({
      status: 'failed',
      id: '422204',
      name: '#422204',
      reason: 'too_large',
    })
  })

  it('also refuses a body over the limit that slipped past the download check', async () => {
    const download = vi.fn().mockResolvedValue({
      data: Buffer.alloc(ROBOT_FILE_MAX_BYTES + 1),
      contentType: 'video/mp4',
      contentDisposition: 'attachment; filename="video.mp4"',
    })

    const results = await fetchRobotFiles(makeDeps(download), deal, ['422204'])

    expect(results[0]).toMatchObject({
      status: 'failed',
      name: 'video.mp4',
      reason: 'too_large',
    })
  })

  it('does nothing without ids', async () => {
    const deps = makeDeps()
    expect(await fetchRobotFiles(deps, deal, [])).toEqual([])
    expect(deps.getCrmItem).not.toHaveBeenCalled()
  })
})

describe('crmEntityTypeIdOf', () => {
  it('maps bizproc document entities to CRM entity type ids', () => {
    expect(crmEntityTypeIdOf('LEAD')).toBe(1)
    expect(crmEntityTypeIdOf('DEAL')).toBe(2)
    expect(crmEntityTypeIdOf('CONTACT')).toBe(3)
    expect(crmEntityTypeIdOf('COMPANY')).toBe(4)
    expect(crmEntityTypeIdOf('DYNAMIC_183')).toBe(183)
    expect(crmEntityTypeIdOf('UNKNOWN')).toBeNull()
  })
})

describe('fileNameFromDisposition', () => {
  it('prefers the UTF-8 filename* over the ASCII filename', () => {
    expect(
      fileNameFromDisposition(
        `attachment; filename="Captura-de-tela.png"; filename*=utf-8''Captura%20de%20tela%20%C3%A1.png`,
      ),
    ).toBe('Captura de tela á.png')
  })

  it('falls back to filename and strips any path', () => {
    expect(
      fileNameFromDisposition('attachment; filename="pasta/boleto.pdf"'),
    ).toBe('boleto.pdf')
    expect(fileNameFromDisposition('attachment; filename=boleto.pdf')).toBe(
      'boleto.pdf',
    )
  })

  it('returns undefined without a filename', () => {
    expect(fileNameFromDisposition(undefined)).toBeUndefined()
    expect(fileNameFromDisposition('inline')).toBeUndefined()
  })
})
