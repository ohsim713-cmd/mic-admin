import { describe, it, expect } from 'vitest'

// サンプルテスト
describe('utils', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle strings', () => {
    const text = 'チャトレ事務所'
    expect(text).toContain('事務所')
    expect(text.length).toBeLessThan(280) // Twitter制限
  })
})
