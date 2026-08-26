import { describe, expect, it } from 'vitest'
import { DEFAULT_WORKTIME, isAgentAvailableAt, type Worktime } from './worktime'

/**
 * As datas são fixas e em UTC, e o fuso entra só pelo `timezone` do agente.
 * Assim o teste não depende do fuso da máquina que o roda — que em CI é UTC e
 * na máquina de quem desenvolve, não.
 */
function worktime(overrides: Partial<Worktime> = {}): Worktime {
  return {
    ...DEFAULT_WORKTIME,
    enabled: true,
    initHour: '09:00',
    endHour: '18:00',
    // Segunda a sexta.
    activeDays: [1, 2, 3, 4, 5],
    timezone: 'America/Sao_Paulo',
    ...overrides,
  }
}

describe('isAgentAvailableAt', () => {
  it('está sempre disponível com o horário desligado', () => {
    // Domingo 03:00 UTC — fora de qualquer janela configurada abaixo.
    const domingoDeMadrugada = new Date('2026-08-23T03:00:00Z')

    expect(
      isAgentAvailableAt(worktime({ enabled: false }), domingoDeMadrugada),
    ).toBe(true)
  })

  it('está disponível dentro da janela', () => {
    // Segunda, 14:00 UTC = 11:00 em São Paulo (UTC-3).
    expect(
      isAgentAvailableAt(worktime(), new Date('2026-08-24T14:00:00Z')),
    ).toBe(true)
  })

  it('não está disponível fora da janela', () => {
    // Segunda, 23:00 UTC = 20:00 em São Paulo — depois das 18:00.
    expect(
      isAgentAvailableAt(worktime(), new Date('2026-08-24T23:00:00Z')),
    ).toBe(false)
  })

  it('não está disponível em dia fora de activeDays', () => {
    // Domingo, 14:00 UTC = 11:00 em São Paulo: dentro do horário, fora do dia.
    expect(
      isAgentAvailableAt(worktime(), new Date('2026-08-23T14:00:00Z')),
    ).toBe(false)
  })

  describe('respondsOnlyOffHours inverte a janela', () => {
    const invertido = worktime({ respondsOnlyOffHours: true })

    it('silencia dentro do expediente', () => {
      // Segunda, 11:00 em São Paulo.
      expect(
        isAgentAvailableAt(invertido, new Date('2026-08-24T14:00:00Z')),
      ).toBe(false)
    })

    it('atende fora do expediente', () => {
      // Segunda, 20:00 em São Paulo.
      expect(
        isAgentAvailableAt(invertido, new Date('2026-08-24T23:00:00Z')),
      ).toBe(true)
    })

    it('atende em dia fora de activeDays', () => {
      // Domingo, 11:00 em São Paulo: fora do expediente, portanto atende.
      expect(
        isAgentAvailableAt(invertido, new Date('2026-08-23T14:00:00Z')),
      ).toBe(true)
    })
  })

  describe('janela que cruza a meia-noite', () => {
    // Plantão noturno: 22:00 às 02:00, todos os dias.
    const noturno = worktime({
      initHour: '22:00',
      endHour: '02:00',
      activeDays: [0, 1, 2, 3, 4, 5, 6],
    })

    it('está disponível antes da meia-noite', () => {
      // Segunda, 02:00 UTC de terça = 23:00 de segunda em São Paulo.
      expect(
        isAgentAvailableAt(noturno, new Date('2026-08-25T02:00:00Z')),
      ).toBe(true)
    })

    it('está disponível depois da meia-noite', () => {
      // Terça, 04:00 UTC = 01:00 de terça em São Paulo.
      expect(
        isAgentAvailableAt(noturno, new Date('2026-08-25T04:00:00Z')),
      ).toBe(true)
    })

    it('não está disponível no meio do dia', () => {
      // Terça, 15:00 UTC = 12:00 em São Paulo.
      expect(
        isAgentAvailableAt(noturno, new Date('2026-08-25T15:00:00Z')),
      ).toBe(false)
    })
  })

  describe('fuso com horário de verão', () => {
    /**
     * Nova York alterna entre UTC-5 (inverno) e UTC-4 (verão). O mesmo horário
     * UTC cai em horas locais diferentes conforme a época — que é exatamente o
     * que a soma manual de offset do HubThink errava.
     */
    const nova_york = worktime({ timezone: 'America/New_York' })

    it('resolve a hora local no inverno', () => {
      // 2026-01-05 é segunda. 14:00 UTC = 09:00 em NY (UTC-5): dentro.
      expect(
        isAgentAvailableAt(nova_york, new Date('2026-01-05T14:00:00Z')),
      ).toBe(true)
      // 13:00 UTC = 08:00 em NY: fora.
      expect(
        isAgentAvailableAt(nova_york, new Date('2026-01-05T13:00:00Z')),
      ).toBe(false)
    })

    it('resolve a hora local no verão', () => {
      // 2026-07-06 é segunda. 13:00 UTC = 09:00 em NY (UTC-4): dentro.
      expect(
        isAgentAvailableAt(nova_york, new Date('2026-07-06T13:00:00Z')),
      ).toBe(true)
      // 12:00 UTC = 08:00 em NY: fora.
      expect(
        isAgentAvailableAt(nova_york, new Date('2026-07-06T12:00:00Z')),
      ).toBe(false)
    })
  })

  it('cai no fuso padrão quando o agente não tem timezone', () => {
    // Segunda, 14:00 UTC = 11:00 em São Paulo, o default.
    expect(
      isAgentAvailableAt(
        worktime({ timezone: null }),
        new Date('2026-08-24T14:00:00Z'),
      ),
    ).toBe(true)
  })

  describe('janela incompleta não delimita nada', () => {
    it('sem horários, com a regra ligada, não atende', () => {
      expect(
        isAgentAvailableAt(
          worktime({ initHour: null, endHour: null }),
          new Date('2026-08-24T14:00:00Z'),
        ),
      ).toBe(false)
    })

    it('sem horários e invertido, atende sempre', () => {
      expect(
        isAgentAvailableAt(
          worktime({
            initHour: null,
            endHour: null,
            respondsOnlyOffHours: true,
          }),
          new Date('2026-08-24T14:00:00Z'),
        ),
      ).toBe(true)
    })

    it('horário malformado não derruba a avaliação', () => {
      expect(
        isAgentAvailableAt(
          worktime({ initHour: '25:00' }),
          new Date('2026-08-24T14:00:00Z'),
        ),
      ).toBe(false)
    })
  })

  it('trata a meia-noite como início do dia', () => {
    // Domingo 03:00 UTC = domingo 00:00 em São Paulo (UTC-3). Cobre o caso em
    // que `hour12: false` rende "24" em vez de "00" para a meia-noite.
    const meiaNoite = worktime({
      initHour: '00:00',
      endHour: '06:00',
      activeDays: [0],
    })

    expect(
      isAgentAvailableAt(meiaNoite, new Date('2026-08-23T03:00:00Z')),
    ).toBe(true)
  })
})
