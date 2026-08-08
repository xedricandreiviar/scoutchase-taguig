/**
 * Property-based tests for quiz scoring correctness.
 *
 * Property 12: Quiz scoring correctness
 * For any set of quiz answers and a corresponding answer key, the computed score
 * SHALL equal the count of answers that match the key multiplied by the
 * points-per-question value.
 *
 * Validates: Requirements 9.7
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { scoreQuiz } from './quiz-scorer'
import type { TriviaQuestion } from './filter'

/**
 * Generate a valid TriviaQuestion with a random correct_answer index.
 */
const arbTriviaQuestion = (numOptions: number): fc.Arbitrary<TriviaQuestion> =>
  fc.record({
    question: fc.string({ minLength: 1, maxLength: 100 }),
    options: fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
      minLength: numOptions,
      maxLength: numOptions,
    }),
    correct_answer: fc.nat({ max: numOptions - 1 }),
  })

/**
 * Generate a set of TriviaQuestions (1 to 10 questions, each with 2-5 options).
 */
const arbQuestions: fc.Arbitrary<TriviaQuestion[]> = fc
  .integer({ min: 1, max: 10 })
  .chain((count) =>
    fc.integer({ min: 2, max: 5 }).chain((numOptions) =>
      fc.array(arbTriviaQuestion(numOptions), {
        minLength: count,
        maxLength: count,
      })
    )
  )

/**
 * Generate arbitrary user answers as a Record<number, number>.
 * Answers map question index to selected option index.
 */
const arbAnswers = (
  questionCount: number,
  maxOptionIndex: number
): fc.Arbitrary<Record<number, number>> =>
  fc
    .array(fc.nat({ max: maxOptionIndex }), {
      minLength: questionCount,
      maxLength: questionCount,
    })
    .map((answers) => {
      const record: Record<number, number> = {}
      for (let i = 0; i < answers.length; i++) {
        record[i] = answers[i]
      }
      return record
    })

/**
 * Generate a positive points-per-question value.
 */
const arbPointsPerQuestion = fc.integer({ min: 1, max: 100 })

describe('Property 12: Quiz scoring correctness', () => {
  it('score equals correct_count × points_per_question for any inputs', () => {
    fc.assert(
      fc.property(arbQuestions, arbPointsPerQuestion, (questions, pointsPerQuestion) => {
        // Generate random answers for all questions
        const maxOptionIndex = questions[0].options.length - 1
        const answersArb = arbAnswers(questions.length, maxOptionIndex)

        fc.assert(
          fc.property(answersArb, (answers) => {
            const result = scoreQuiz(answers, questions, pointsPerQuestion)

            // Manually count correct answers
            let expectedCorrect = 0
            for (let i = 0; i < questions.length; i++) {
              if (answers[i] === questions[i].correct_answer) {
                expectedCorrect++
              }
            }

            expect(result.correct).toBe(expectedCorrect)
            expect(result.total).toBe(questions.length)
            expect(result.score).toBe(expectedCorrect * pointsPerQuestion)
          }),
          { numRuns: 10 }
        )
      }),
      { numRuns: 50 }
    )
  })

  it('all correct answers → score = total × points', () => {
    fc.assert(
      fc.property(arbQuestions, arbPointsPerQuestion, (questions, pointsPerQuestion) => {
        // Create answers that match all correct answers
        const answers: Record<number, number> = {}
        for (let i = 0; i < questions.length; i++) {
          answers[i] = questions[i].correct_answer
        }

        const result = scoreQuiz(answers, questions, pointsPerQuestion)

        expect(result.correct).toBe(questions.length)
        expect(result.total).toBe(questions.length)
        expect(result.score).toBe(questions.length * pointsPerQuestion)
      }),
      { numRuns: 100 }
    )
  })

  it('no correct answers → score = 0', () => {
    fc.assert(
      fc.property(arbQuestions, arbPointsPerQuestion, (questions, pointsPerQuestion) => {
        // Create answers that never match the correct answer
        const answers: Record<number, number> = {}
        for (let i = 0; i < questions.length; i++) {
          // Pick an option that's NOT the correct one
          const correctIdx = questions[i].correct_answer
          const numOptions = questions[i].options.length
          // Use the next index wrapping around
          answers[i] = (correctIdx + 1) % numOptions
        }

        const result = scoreQuiz(answers, questions, pointsPerQuestion)

        expect(result.correct).toBe(0)
        expect(result.total).toBe(questions.length)
        expect(result.score).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  it('score is non-negative', () => {
    fc.assert(
      fc.property(arbQuestions, arbPointsPerQuestion, (questions, pointsPerQuestion) => {
        const maxOptionIndex = questions[0].options.length - 1
        const answersArb = arbAnswers(questions.length, maxOptionIndex)

        fc.assert(
          fc.property(answersArb, (answers) => {
            const result = scoreQuiz(answers, questions, pointsPerQuestion)

            expect(result.score).toBeGreaterThanOrEqual(0)
            expect(result.correct).toBeGreaterThanOrEqual(0)
            expect(result.total).toBeGreaterThanOrEqual(0)
          }),
          { numRuns: 10 }
        )
      }),
      { numRuns: 50 }
    )
  })

  it('score is deterministic', () => {
    fc.assert(
      fc.property(arbQuestions, arbPointsPerQuestion, (questions, pointsPerQuestion) => {
        const maxOptionIndex = questions[0].options.length - 1
        const answersArb = arbAnswers(questions.length, maxOptionIndex)

        fc.assert(
          fc.property(answersArb, (answers) => {
            const result1 = scoreQuiz(answers, questions, pointsPerQuestion)
            const result2 = scoreQuiz(answers, questions, pointsPerQuestion)

            expect(result1.score).toBe(result2.score)
            expect(result1.correct).toBe(result2.correct)
            expect(result1.total).toBe(result2.total)
          }),
          { numRuns: 10 }
        )
      }),
      { numRuns: 50 }
    )
  })
})
