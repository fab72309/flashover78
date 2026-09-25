import { describe, expect, it } from 'vitest'
import { selectConfiguredKey } from './config'

describe('server key configuration', () => {
  it('prefers the explicit legacy value when present', () => {
    expect(selectConfiguredKey(' legacy-key ', '{"default":"named-key"}')).toBe('legacy-key')
  })

  it('accepts only an explicit default in the named JSON form', () => {
    expect(selectConfiguredKey('', '{"default":" named-key "}')).toBe('named-key')
    expect(selectConfiguredKey('', '{"project-a":"wrong-project-key"}')).toBe('')
    expect(selectConfiguredKey('', '{"default":123}')).toBe('')
  })

  it('fails closed for malformed or non-object configuration', () => {
    expect(selectConfiguredKey('', '{not-json')).toBe('')
    expect(selectConfiguredKey('', '[]')).toBe('')
    expect(selectConfiguredKey('', '')).toBe('')
  })
})
