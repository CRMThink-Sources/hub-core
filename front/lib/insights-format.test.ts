import { describe, expect, it } from 'vitest'
import {
  buildTeamCsv,
  crmUrl,
  defaultPeriod,
  deltaPercent,
  formatClock,
  formatDuration,
  formatDurationShort,
  formatMoney,
  formatPercent,
  noAnswerLevel,
  periodDayIso,
  periodDayLabel,
  outOfTen,
  peakHours,
  ratioPercent,
  recontactLevel,
  roundAxisMax,
  slaLevel,
  trendOf,
  waitAxisMax,
} from './insights-format'

describe('formatDuration', () => {
  it('formata segundos como "2 min 05 s"', () => {
    expect(formatDuration(125)).toBe('2 min 05 s')
  })

  it('acima de uma hora mostra horas e minutos, sem segundos', () => {
    expect(formatDuration(3725)).toBe('1 h 02 min')
  })

  it('omite a parte menor quando ela é zero', () => {
    expect(formatDuration(120)).toBe('2 min')
    expect(formatDuration(3600)).toBe('1 h')
    expect(formatDuration(2 * 86400)).toBe('2 d')
  })

  it('abaixo de um minuto mostra só segundos', () => {
    expect(formatDuration(0)).toBe('0 s')
    expect(formatDuration(45)).toBe('45 s')
  })

  it('arredonda o total antes de quebrar em partes', () => {
    expect(formatDuration(59.6)).toBe('1 min')
    expect(formatDuration(44.4)).toBe('44 s')
  })

  it('a partir de um dia mostra dias e horas', () => {
    expect(formatDuration(86400 + 3 * 3600 + 59 * 60)).toBe('1 d 03 h')
  })

  it('negativo vira zero', () => {
    expect(formatDuration(-10)).toBe('0 s')
  })

  it('null, NaN e infinito viram travessão', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatDurationShort', () => {
  it('rótulo curto de gráfico em s, m, h e d', () => {
    expect(formatDurationShort(42)).toBe('42s')
    expect(formatDurationShort(600)).toBe('10m')
    expect(formatDurationShort(5400)).toBe('1,5h')
    expect(formatDurationShort(5400, 'en')).toBe('1.5h')
    expect(formatDurationShort(7200)).toBe('2h')
    expect(formatDurationShort(14 * 3600 + 1800)).toBe('15h')
    expect(formatDurationShort(2 * 86400)).toBe('2d')
  })

  it('valor ausente vira travessão', () => {
    expect(formatDurationShort(null)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('uma casa decimal com a vírgula do idioma', () => {
    expect(formatPercent(91.7)).toBe('91,7%')
    expect(formatPercent(91.7, 'en')).toBe('91.7%')
    expect(formatPercent(50)).toBe('50%')
    expect(formatPercent(33.333)).toBe('33,3%')
  })

  it('null e NaN viram travessão', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(Number.NaN)).toBe('—')
  })
})

describe('ratioPercent', () => {
  it('percentual com divisor zero devolve "—"', () => {
    expect(ratioPercent(3, 0)).toBeNull()
    expect(formatPercent(ratioPercent(3, 0))).toBe('—')
  })

  it('calcula a parte sobre o total', () => {
    expect(ratioPercent(1, 4)).toBe(25)
  })
})

describe('deltaPercent', () => {
  it('variação inteira em relação ao período anterior', () => {
    expect(deltaPercent(110, 100)).toBe(10)
    expect(deltaPercent(50, 100)).toBe(-50)
    expect(deltaPercent(100, 100)).toBe(0)
  })

  it('sem base (anterior zero ou ausente) devolve null', () => {
    expect(deltaPercent(5, 0)).toBeNull()
    expect(deltaPercent(null, 10)).toBeNull()
    expect(deltaPercent(10, null)).toBeNull()
  })
})

describe('trendOf', () => {
  it('compara respeitando o sentido do indicador', () => {
    expect(trendOf(80, 70, true)).toBe('better')
    expect(trendOf(80, 70, false)).toBe('worse')
    expect(trendOf(5, 5, true)).toBe('same')
    expect(trendOf(null, 5, true)).toBe('none')
    expect(trendOf(5, null, true)).toBe('none')
  })
})

describe('níveis dos cartões de saúde', () => {
  it('rapidez: 80% bom, 50% atenção, abaixo disso precisa melhorar', () => {
    expect(slaLevel(null)).toBe('none')
    expect(slaLevel(80)).toBe('good')
    expect(slaLevel(50)).toBe('warn')
    expect(slaLevel(49.9)).toBe('bad')
  })

  it('sem resposta: até 5% bom, até 15% atenção', () => {
    expect(noAnswerLevel(null)).toBe('none')
    expect(noAnswerLevel(5)).toBe('good')
    expect(noAnswerLevel(15)).toBe('warn')
    expect(noAnswerLevel(15.1)).toBe('bad')
  })

  it('recontato: até 10% bom, até 25% atenção; sem conversas é sem dados', () => {
    expect(recontactLevel(0, 0)).toBe('none')
    expect(recontactLevel(1, 10)).toBe('good')
    expect(recontactLevel(25, 100)).toBe('warn')
    expect(recontactLevel(26, 100)).toBe('bad')
  })

  it('outOfTen arredonda o percentual para "x em cada 10"', () => {
    expect(outOfTen(84)).toBe(8)
    expect(outOfTen(85)).toBe(9)
  })
})

describe('formatClock', () => {
  it('minutos desde a meia-noite em HH:MM', () => {
    expect(formatClock(485)).toBe('08:05')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(null)).toBe('—')
  })

  it('minuto quebrado é arredondado para baixo', () => {
    expect(formatClock(485.7)).toBe('08:05')
  })
})

describe('formatMoney', () => {
  it('real sem centavos', () => {
    expect(formatMoney(1500).replace(/\s/g, ' ')).toBe('R$ 1.500')
    expect(formatMoney(null).replace(/\s/g, ' ')).toBe('R$ 0')
  })
})

describe('crmUrl', () => {
  it('monta o link do CRM no portal', () => {
    expect(crmUrl('empresa.bitrix24.com.br', 'deal', 42)).toBe(
      'https://empresa.bitrix24.com.br/crm/deal/details/42/',
    )
  })

  it('recusa portal que não é um host, tipo desconhecido ou id inválido', () => {
    expect(crmUrl(null, 'deal', 42)).toBeNull()
    expect(crmUrl('javascript:alert(1)//', 'deal', 42)).toBeNull()
    expect(crmUrl('evil.com/x', 'deal', 42)).toBeNull()
    expect(crmUrl('empresa.bitrix24.com.br', 'quote', 42)).toBeNull()
    expect(crmUrl('empresa.bitrix24.com.br', 'deal', null)).toBeNull()
    expect(crmUrl('empresa.bitrix24.com.br', 'deal', 0)).toBeNull()
  })
})

describe('eixos dos gráficos', () => {
  it('roundAxisMax arredonda para 2, 5 ou 10 vezes a potência de 10', () => {
    expect(roundAxisMax(3)).toBe(5)
    expect(roundAxisMax(12)).toBe(20)
    expect(roundAxisMax(31)).toBe(50)
    expect(roundAxisMax(51)).toBe(100)
  })

  it('waitAxisMax usa um teto redondo de tempo e limita em 6x a referência', () => {
    // referência 15 min = 900 s: mínimo 1,5x (1350 s) → 1200 não basta → 2400
    expect(waitAxisMax([], 900)).toBe(2400)
    // um valor extremo é cortado em 6x a referência (5400 s) → 7200
    expect(waitAxisMax([100000], 900)).toBe(7200)
    expect(waitAxisMax([null, 3000], 900)).toBe(3600)
  })
})

describe('peakHours', () => {
  it('devolve as duas horas mais movimentadas e o intervalo com movimento', () => {
    const byHour = Array.from({ length: 24 }, () => 0)
    byHour[9] = 5
    byHour[14] = 8
    byHour[17] = 2
    expect(peakHours(byHour)).toEqual({ top: [14, 9], first: 9, last: 17 })
  })

  it('sem movimento devolve null', () => {
    expect(peakHours(Array.from({ length: 24 }, () => 0))).toBeNull()
  })
})

describe('defaultPeriod', () => {
  it('últimos 30 dias contando hoje, no fuso local', () => {
    expect(defaultPeriod(new Date(2026, 10, 18, 23, 30))).toEqual({
      from: '2026-10-20',
      to: '2026-11-18',
    })
  })
})

describe('buildTeamCsv', () => {
  it('separa por ponto e vírgula, escapa aspas e começa com BOM', () => {
    const csv = buildTeamCsv(['Nome', 'Conversas'], [['Ana "A"', 3]])
    expect(csv).toBe('﻿"Nome";"Conversas"\n"Ana ""A""";"3"')
  })

  it('neutraliza célula que a planilha leria como fórmula', () => {
    const csv = buildTeamCsv(['Nome'], [['=HYPERLINK("x")'], ['-1'], [-1]])
    expect(csv.split('\n').slice(1)).toEqual([
      '"\'=HYPERLINK(""x"")"',
      '"\'-1"',
      '"-1"',
    ])
  })

  it('null vira célula vazia', () => {
    expect(buildTeamCsv(['A'], [[null]])).toBe('﻿"A"\n""')
  })
})

describe('periodDayLabel / periodDayIso', () => {
  it('lê o dia no fuso de Brasília, não em UTC', () => {
    // 23:59:59 de Brasília já é o dia seguinte em UTC
    const to = '2026-11-19T02:59:59.000Z'
    expect(periodDayIso(to)).toBe('2026-11-18')
    expect(periodDayLabel(to, 'pt-BR')).toBe('18/11/2026')
  })

  it('início do dia em Brasília continua no mesmo dia', () => {
    expect(periodDayIso('2026-10-20T03:00:00.000Z')).toBe('2026-10-20')
  })

  it('data inválida vira vazio, nunca "Invalid Date"', () => {
    expect(periodDayLabel('2026-10-20', 'pt-BR')).not.toContain('Invalid')
    expect(periodDayLabel('lixo', 'pt-BR')).toBe('')
    expect(periodDayIso('lixo')).toBe('')
  })
})
