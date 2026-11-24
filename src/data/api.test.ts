import { describe, expect, it } from 'vitest'
import { api, resolveApiBase } from './api'

describe('resolveApiBase', () => {
  it('prefers the runtime URL and trims trailing slashes', () => {
    expect(resolveApiBase('http://api:8000/', 'http://localhost:8000')).toBe('http://api:8000')
    expect(resolveApiBase('', 'http://localhost:8000/')).toBe('http://localhost:8000')
    expect(resolveApiBase(undefined, undefined)).toBe('')
  })

  it('exposes a string base', () => {
    expect(typeof api.base).toBe('string')
  })
})
