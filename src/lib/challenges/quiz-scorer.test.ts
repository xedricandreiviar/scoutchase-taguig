import { describe, it, expect } from 'vitest'
import { scoreQuiz } from './quiz-scorer'
import type { TriviaQuestion } from './filter'

describe('scoreQuiz', () => {
  const sampleQuestions: TriviaQuestion[] = [
    { question: 'What year was Taguig founded?', options: ['1571', '1587', '1601', '1620'], correct_answer: 1 },
    { question: 'Which lake borders Taguig?', options: ['Taal', 'Laguna de Bay', 'Lanao', 'Sampaloc'], correct_answer: 1 },
    { question: 'What is the Taguig city flower?', options: ['Sampaguita', 'Rose', 'Gumamela', 'Sunflower'], correct_answer: 2 },
  ]

  it('scores all correct answers', () => {
    const answers = { 0: 1, 1: 1, 2: 2 }
    const result = scoreQuiz(answers, sampleQuestions, 10)
    expect(result.correct).toBe(3)
    expect(result.total).toBe(3)
    expect(result.score).toBe(30)
  })

  it('scores all incorrect answers', () => {
    const answers = { 0: 0, 1: 0, 2: 0 }
    const result = scoreQuiz(answers, sampleQuestions, 10)
    expect(result.correct).toBe(0)
    expect(result.total).toBe(3)
    expect(result.score).toBe(0)
  })

  it('scores partial correct answers', () => {
    const answers = { 0: 1, 1: 0, 2: 2 }
    const result = scoreQuiz(answers, sampleQuestions, 10)
    expect(result.correct).toBe(2)
    expect(result.total).toBe(3)
    expect(result.score).toBe(20)
  })

  it('handles empty questions array', () => {
    const result = scoreQuiz({}, [], 10)
    expect(result.correct).toBe(0)
    expect(result.total).toBe(0)
    expect(result.score).toBe(0)
  })

  it('handles missing answers (unanswered questions count as wrong)', () => {
    const answers = { 0: 1 } // Only answered first question
    const result = scoreQuiz(answers, sampleQuestions, 10)
    expect(result.correct).toBe(1)
    expect(result.total).toBe(3)
    expect(result.score).toBe(10)
  })

  it('uses the provided points_per_question value', () => {
    const answers = { 0: 1, 1: 1, 2: 2 }
    const result = scoreQuiz(answers, sampleQuestions, 25)
    expect(result.correct).toBe(3)
    expect(result.total).toBe(3)
    expect(result.score).toBe(75)
  })

  it('handles single question quiz', () => {
    const singleQuestion: TriviaQuestion[] = [
      { question: 'Capital of Philippines?', options: ['Cebu', 'Manila', 'Davao'], correct_answer: 1 },
    ]
    const correct = scoreQuiz({ 0: 1 }, singleQuestion, 50)
    expect(correct.correct).toBe(1)
    expect(correct.total).toBe(1)
    expect(correct.score).toBe(50)

    const wrong = scoreQuiz({ 0: 0 }, singleQuestion, 50)
    expect(wrong.correct).toBe(0)
    expect(wrong.total).toBe(1)
    expect(wrong.score).toBe(0)
  })

  it('handles zero points per question', () => {
    const answers = { 0: 1, 1: 1, 2: 2 }
    const result = scoreQuiz(answers, sampleQuestions, 0)
    expect(result.correct).toBe(3)
    expect(result.total).toBe(3)
    expect(result.score).toBe(0)
  })
})
