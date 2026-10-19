import { describe, expect, it } from 'vitest'
import { parseRobotFiles } from './parse-robot-files'

describe('parseRobotFiles', () => {
  it('reads the captured format: an array of id strings', () => {
    expect(parseRobotFiles(['422204', '422206'])).toEqual(['422204', '422206'])
  })

  it('reads a single id as a string or a number', () => {
    expect(parseRobotFiles('422204')).toEqual(['422204'])
    expect(parseRobotFiles(422204)).toEqual(['422204'])
  })

  it('reads an indexed object (urlencoded list)', () => {
    expect(parseRobotFiles({ 0: '422204', 1: '422206' })).toEqual([
      '422204',
      '422206',
    ])
  })

  it('returns no ids when the property is missing or empty', () => {
    expect(parseRobotFiles(undefined)).toEqual([])
    expect(parseRobotFiles(null)).toEqual([])
    expect(parseRobotFiles('')).toEqual([])
    expect(parseRobotFiles([])).toEqual([])
    expect(parseRobotFiles([''])).toEqual([])
  })

  it('drops values that are not ids and repeated ids, keeping the order', () => {
    expect(
      parseRobotFiles([' 422206 ', 'abc', '422204', '422206', '12.5']),
    ).toEqual(['422206', '422204'])
  })
})
