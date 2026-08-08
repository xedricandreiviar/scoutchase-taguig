import type { TriviaQuestion } from './filter'

/**
 * Quiz/puzzle scoring result.
 */
export interface QuizScoreResult {
  correct: number
  total: number
  score: number
}

/**
 * Scores a trivia quiz or puzzle by comparing user answers against the answer key.
 *
 * Score = count of correct answers × points_per_question
 *
 * Validates: Requirements 9.7 (Property 12: Quiz scoring correctness)
 *
 * @param answers - Record mapping question index to selected option index
 * @param questions - Array of TriviaQuestion objects containing the correct_answer
 * @param pointsPerQuestion - Points awarded for each correct answer
 * @returns QuizScoreResult with correct count, total questions, and calculated score
 */
export function scoreQuiz(
  answers: Record<number, number>,
  questions: TriviaQuestion[],
  pointsPerQuestion: number
): QuizScoreResult {
  const total = questions.length

  if (total === 0) {
    return { correct: 0, total: 0, score: 0 }
  }

  let correct = 0
  for (let i = 0; i < total; i++) {
    if (answers[i] === questions[i].correct_answer) {
      correct++
    }
  }

  const score = correct * pointsPerQuestion

  return { correct, total, score }
}
