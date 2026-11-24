import { describe, expect, it } from 'vitest'
import { QUIZ } from './quiz'
import { bestKeyFor, missedIds, readBest, writeBest } from './quizProgress'

describe('quizProgress', () => {
  it('uses per-language best keys', () => {
    expect(bestKeyFor('en')).toBe('tau-quiz-best-en')
    expect(bestKeyFor('tr')).toBe('tau-quiz-best-tr')
    expect(bestKeyFor('en')).not.toBe(bestKeyFor('tr'))
  })

  it('best starts at 0 and only ratchets up', () => {
    // memory fallback in the node test env starts empty
    expect(readBest('en') >= 0).toBe(true)
    const before = readBest('tr')
    writeBest('tr', before + 2)
    expect(readBest('tr')).toBe(before + 2)
    writeBest('tr', 0)
    expect(readBest('tr')).toBe(before + 2)
  })

  it('missedIds finds wrong answers only', () => {
    const answers: Record<string, number> = {}
    for (const q of QUIZ) answers[q.id] = q.answer
    expect(missedIds(answers, QUIZ)).toEqual([])
    const flip = (qi: number) => (QUIZ[qi].answer + 1) % QUIZ[qi].options.length
    const wrong = { ...answers, q2: flip(1), q4: flip(3) }
    expect(missedIds(wrong, QUIZ)).toEqual(['q2', 'q4'])
    expect(missedIds({ ...wrong, q4: QUIZ[3].answer }, QUIZ)).toEqual(['q2'])
  })
})
