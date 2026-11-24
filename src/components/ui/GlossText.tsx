import { useMemo } from 'react'
import { glossParts } from '../../data/glossary'
import { useT } from '../../hooks/useT'

/**
 * Teaching text with dotted-underline glossary terms.
 * Hover shows the definition; focusable so keyboard/touch readers get it too.
 */
export function GlossText({ text }: { text: string }) {
  const { lang } = useT()
  const parts = useMemo(() => glossParts(text, lang), [text, lang])
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <abbr
            key={i}
            title={p.def}
            aria-label={`${p.term}: ${p.def}`}
            tabIndex={0}
            className="underline decoration-dotted underline-offset-2 cursor-help"
            style={{ textDecorationColor: 'currentColor' }}
          >
            {p.term}
          </abbr>
        ),
      )}
    </>
  )
}
