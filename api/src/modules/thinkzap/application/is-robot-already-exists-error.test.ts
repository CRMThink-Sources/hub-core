import { describe, expect, it } from 'vitest'
import { BitrixApiError } from '@/shared/infra/clients/bitrix-api.error'
import { isRobotAlreadyExistsError } from './is-robot-already-exists-error'

describe('isRobotAlreadyExistsError', () => {
  it('classifies by code even when the description is translated and has no marker', () => {
    const error = new BitrixApiError(
      'bizproc.robot.add',
      'ERROR_ACTIVITY_VALIDATION_FAILURE',
      'Ya existe un robot con este código',
      'Bitrix bizproc.robot.add: Ya existe un robot con este código',
    )

    expect(isRobotAlreadyExistsError(error)).toBe(true)
  })

  it('falls back to message markers for a plain error', () => {
    expect(isRobotAlreadyExistsError(new Error('duplicate robot code'))).toBe(
      true,
    )
  })

  it('does not classify an unrelated error as already-exists', () => {
    expect(isRobotAlreadyExistsError(new Error('Access denied!'))).toBe(false)
  })
})
