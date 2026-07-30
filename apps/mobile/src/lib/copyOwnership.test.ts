import { describe, expect, it } from 'vitest'
import { findCopyViolations } from '../../scripts/copyOwnership'

describe('copy ownership AST check', () => {
  it('finds rendered, accessible, placeholder, and toast literals', () => {
    const findings = findCopyViolations(`
      const screen = <><Text>Hello</Text><Button label="Continue" />
        <TextInput placeholder={'Search'} accessibilityHint={\`Type here\`} /></>
      showToast('Saved')
    `)

    expect(findings.map((finding) => finding.message)).toEqual([
      expect.stringContaining('"Hello"'),
      expect.stringContaining('"Continue"'),
      expect.stringContaining('"Search"'),
      expect.stringContaining('"Type here"'),
      expect.stringContaining('"Saved"'),
    ])
  })

  it('allows copy references, domain keys, routes, diagnostics, and interpolated content', () => {
    expect(
      findCopyViolations(`
        const mode = 'discover'
        const route = '/practice/refrain'
        console.error('native module unavailable')
        const screen = <Button label={copy.common.continue} accessibilityLabel={catalog.label} />
        showToast(copy.toast.saved)
      `),
    ).toEqual([])
  })
})
