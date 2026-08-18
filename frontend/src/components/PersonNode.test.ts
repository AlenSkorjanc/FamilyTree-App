import { describe, expect, it } from 'vitest'
import { personGenderTone } from './PersonNode'

describe('person node gender tint', () => {
  it('recognizes stored and localized male values', () => {
    expect(personGenderTone('MALE')).toBe('male')
    expect(personGenderTone('Moški')).toBe('male')
  })

  it('recognizes stored and localized female values', () => {
    expect(personGenderTone('FEMALE')).toBe('female')
    expect(personGenderTone('Ženska')).toBe('female')
  })

  it('keeps missing and unknown values neutral', () => {
    expect(personGenderTone(null)).toBe('neutral')
    expect(personGenderTone('OTHER')).toBe('neutral')
  })
})
