import { describe, expect, it } from 'vitest'
import { escapeHtml } from './html.ts'

describe('HTML email output encoding', () => {
  it('renders injected tags and event handlers as literal text', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"><script>alert(1)</script>'))
      .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('encodes quotes, ampersands and pre-encoded entities without entity bypass', () => {
    expect(escapeHtml(`'" & &#60;script&#62;`))
      .toBe('&#039;&quot; &amp; &amp;#60;script&amp;#62;')
  })

  it('preserves French text, newlines and SQL-looking text as data', () => {
    expect(escapeHtml("L'équipe < 5 & > 2\nÉchauffement ; DROP TABLE users; --"))
      .toBe('L&#039;équipe &lt; 5 &amp; &gt; 2\nÉchauffement ; DROP TABLE users; --')
  })

  it('allows only the deliberate line-break markup in multiline email fields', () => {
    const output = escapeHtml('Ligne 1\n<iframe src="javascript:alert(1)"></iframe>').replace(/\n/g, '<br />')
    expect(output.match(/<[^>]*>/g)).toEqual(['<br />'])
  })
})
