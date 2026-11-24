import { AnimatePresence, motion } from 'framer-motion'
import { GraduationCap, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getQuiz } from '../../i18n/content'
import { api } from '../../data/api'
import { missedIds, readBest, writeBest } from '../../data/quizProgress'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useT } from '../../hooks/useT'
import { useAppStore } from '../../store/useAppStore'

export function QuizPanel() {
  const { quizOpen, setQuizOpen, lang } = useAppStore()
  const { t } = useT()
  const trapRef = useFocusTrap<HTMLDivElement>(quizOpen)
  const QUIZ = useMemo(() => getQuiz(lang), [lang])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [retryIds, setRetryIds] = useState<string[] | null>(null)
  const savedRef = useRef<string>('')
  const score = useMemo(() => QUIZ.filter((q) => answers[q.id] === q.answer).length, [answers, QUIZ])
  const done = Object.keys(answers).length === QUIZ.length
  // Best is derived during render (localStorage read is cheap/sync); no effect needed.
  const best = Math.max(readBest(lang), done ? score : 0)
  const missed = useMemo(() => missedIds(answers, QUIZ), [answers, QUIZ])
  const visible = retryIds ? QUIZ.filter((q) => retryIds.includes(q.id)) : QUIZ
  const retryRemaining = retryIds ? retryIds.filter((id) => answers[id] !== QUIZ.find((q) => q.id === id)?.answer) : []
  // ids are stable across langs (q1..q5), so answers carry over; lang prefix forces re-save after switch
  const answerKey = `${lang}|` + Object.keys(answers).sort().map((k) => `${k}:${answers[k]}`).join(',')

  useEffect(() => {
    if (!done || savedRef.current === answerKey) return
    savedRef.current = answerKey
    writeBest(lang, score)
    if (!api.base) return
    fetch(`${api.base}/api/quiz-attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, total: QUIZ.length, ts: Date.now() }),
    }).catch(() => undefined)
  }, [done, answerKey, score, QUIZ.length, lang])

  const resetAll = () => {
    setAnswers({})
    setRetryIds(null)
    savedRef.current = ''
  }

  return (
    <AnimatePresence>
      {quizOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: 'rgba(2,6,12,.6)', backdropFilter: 'blur(6px)' }}
          role="dialog"
          aria-modal="true"
          aria-label={t('quizDialog')}
          onClick={() => setQuizOpen(false)}
        >
          <motion.div
            ref={trapRef}
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-2xl max-w-[600px] w-full p-4 sm:p-5 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold inline-flex items-center gap-2">
                <GraduationCap size={18} /> {t('quizTitle')(retryIds ? retryIds.length : QUIZ.length)}
              </h2>
              <button type="button" aria-label={t('quizClose')} onClick={() => setQuizOpen(false)} className="min-w-[44px] min-h-[44px] grid place-items-center rounded-lg glass active:scale-95 shrink-0">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs opacity-70 mt-1">{t('quizSubtitle')}</p>
            <div className="mt-3 space-y-3">
              {visible.map((q) => {
                const qi = QUIZ.findIndex((x) => x.id === q.id)
                return (
                <fieldset key={q.id} className="rounded-xl p-3 border" style={{ borderColor: 'rgba(148,163,184,.25)' }}>
                  <legend className="text-xs px-1 opacity-70">Q{qi + 1}</legend>
                  <div className="text-sm font-medium">{q.q}</div>
                  <div className="mt-2 grid gap-1.5">
                    {q.options.map((opt, oi) => {
                      const picked = answers[q.id] === oi
                      const correct = q.answer === oi
                      const show = answers[q.id] !== undefined
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                          className="text-left text-sm px-3.5 rounded-lg border active:scale-[.99]"
                          style={{
                            minHeight: 48,
                            borderColor: show && correct ? '#009e73' : picked ? '#d55e00' : 'rgba(148,163,184,.3)',
                            background: show && correct ? 'rgba(0,158,115,.15)' : picked ? 'rgba(213,94,0,.15)' : 'transparent',
                          }}
                          aria-pressed={picked}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                  {answers[q.id] !== undefined && (
                    <p className="text-[11px] mt-2 opacity-80">{answers[q.id] === q.answer ? '✓ ' : '✗ '}{q.explain}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const s = useAppStore.getState()
                      s.setStage(q.seeStage)
                      s.setSelection(q.see)
                      setQuizOpen(false)
                    }}
                    className="mt-2 text-xs px-4 rounded-lg glass active:scale-95"
                    style={{ minHeight: 44 }}
                  >
                    {t('seeIn3D')} →
                  </button>
                </fieldset>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm" role="status">
                {t('score')}: <strong>{score}/{QUIZ.length}</strong>
                {best > 0 && <span className="opacity-70"> · {t('best')}: {best}/{QUIZ.length}</span>}
                {' '}
                {done && retryIds && retryRemaining.length === 0 && t('allFixed')}
                {done && !retryIds && (score === QUIZ.length ? t('excellent') : score >= Math.ceil(QUIZ.length * 0.6) ? t('solid') : t('replay'))}
              </div>
              <div className="flex flex-wrap gap-2">
                {done && !retryIds && missed.length > 0 && (
                  <button type="button" onClick={() => setRetryIds(missed)} className="text-xs px-4 rounded-lg glass active:scale-95" style={{ minHeight: 44, borderColor: '#e69f00' }}>
                    {t('retryMissed')} ({missed.length})
                  </button>
                )}
                {retryIds && (
                  <button type="button" onClick={() => setRetryIds(null)} className="text-xs px-4 rounded-lg glass active:scale-95" style={{ minHeight: 44 }}>
                    {t('showAll')}
                  </button>
                )}
                <button type="button" onClick={resetAll} className="text-xs px-4 rounded-lg glass active:scale-95" style={{ minHeight: 44 }}>{t('reset')}</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
