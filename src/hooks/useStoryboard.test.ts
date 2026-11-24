import { describe, expect, it } from 'vitest'
import { buildStoryboardHtml } from './useStoryboard'

describe('storyboard', () => {
  it('builds html with captions', () => {
    const html = buildStoryboardHtml(
      [{ stage: 0, images: ['data:image/png;base64,xxx'] }],
      [{ label: 'Healthy', braak: 'Braak 0', cellular: 'c', tissue: 't', organ: 'o', description: 'd' }]
    )
    expect(html).toContain('Healthy')
    expect(html).toContain('Braak 0')
    expect(html).toContain('data:image/png')
  })
})
