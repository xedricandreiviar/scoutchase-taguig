import type { UserRole } from '@/stores/auth'

/**
 * Supported challenge types in ScoutChase Taguig.
 * Validates: Requirement 9.1
 */
export type ChallengeType =
  | 'trivia_quiz'
  | 'observation'
  | 'photo_documentation'
  | 'puzzle'
  | 'reflection_journal'
  | 'interview'
  | 'storytelling'

/**
 * Difficulty levels for challenges.
 */
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard'

/**
 * Challenge data structure as stored in the database.
 */
export interface Challenge {
  id: string
  heritage_site_id: string
  type: ChallengeType
  difficulty: DifficultyLevel
  title: string
  description: string | null
  content_json: ChallengeContent
  points_reward: number
  max_attempts: number
}

/**
 * Challenge content varies by type.
 */
export interface TriviaQuestion {
  question: string
  options: string[]
  correct_answer: number // index into options
}

export interface ChallengeContent {
  questions?: TriviaQuestion[]
  prompt?: string
  instructions?: string
}

/**
 * Role-based constraints for challenge views.
 * Validates: Requirements 9.2, 9.3
 */
export interface ChallengeConstraints {
  maxTriviaQuestions: number
  maxTextLength: number
  useMultipleChoice: boolean
}

/**
 * Returns challenge constraints based on user role.
 * - Cub_Scout: simplified version (max 3 trivia questions, 200-char limit, multiple-choice)
 * - Boy_Scout/Senior_Scout/Rover_Scout: standard (up to 5 trivia questions, 500-char limit)
 * - Others (Guest, Adult_Leader, Council_Admin): standard constraints
 *
 * Validates: Requirements 9.2, 9.3
 */
export function getChallengeConstraints(role: UserRole): ChallengeConstraints {
  if (role === 'Cub_Scout') {
    return {
      maxTriviaQuestions: 3,
      maxTextLength: 200,
      useMultipleChoice: true,
    }
  }

  // Standard constraints for Boy_Scout, Senior_Scout, Rover_Scout, and others
  return {
    maxTriviaQuestions: 5,
    maxTextLength: 500,
    useMultipleChoice: false,
  }
}

/**
 * Filters challenges by role-based difficulty.
 * Cub_Scout only sees challenges with difficulty 'Easy'.
 * All other roles see challenges of all difficulty levels.
 *
 * Validates: Requirements 3.3 (Property 4: Cub Scout difficulty filtering)
 */
export function filterChallengesByRole(
  challenges: Challenge[],
  role: UserRole
): Challenge[] {
  if (role === 'Cub_Scout') {
    return challenges.filter((challenge) => challenge.difficulty === 'Easy')
  }

  return challenges
}
