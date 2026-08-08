import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  filterChallengesByRole,
  getChallengeConstraints,
} from '@/lib/challenges/filter'
import { scoreQuiz } from '@/lib/challenges/quiz-scorer'
import {
  validateFileUpload,
  getImageDimensions,
} from '@/lib/validators/file-upload'
import type {
  Challenge,
  ChallengeType,
  ChallengeContent,
  TriviaQuestion,
  ChallengeConstraints,
} from '@/lib/challenges/filter'

interface SubmissionResult {
  success: boolean
  points_awarded?: number
  error?: string
}

export default function ChallengeAttempt() {
  const { challengeId } = useParams<{ challengeId: string }>()
  const { user } = useAuthStore()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(3)

  // Form state
  const [triviaAnswers, setTriviaAnswers] = useState<Record<number, number>>({})
  const [textResponse, setTextResponse] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const userRole = user?.role ?? 'Guest'
  const constraints = getChallengeConstraints(userRole)

  useEffect(() => {
    if (!challengeId || !user) return

    async function fetchChallenge() {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single()

      if (fetchError || !data) {
        setError('Challenge not found or unavailable.')
        setIsLoading(false)
        return
      }

      const challengeData: Challenge = {
        id: data.id,
        heritage_site_id: data.heritage_site_id,
        type: data.type as ChallengeType,
        difficulty: data.difficulty,
        title: data.title,
        description: data.description,
        content_json: data.content_json as ChallengeContent,
        points_reward: data.points_reward,
        max_attempts: data.max_attempts,
      }

      // Apply role-based filtering — if challenge is filtered out, deny access
      const filtered = filterChallengesByRole([challengeData], userRole)
      if (filtered.length === 0) {
        setError('This challenge is not available for your role.')
        setIsLoading(false)
        return
      }

      setChallenge(challengeData)

      // Fetch existing submission count for attempts remaining
      const { count } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('challenge_id', challengeId)

      const used = count ?? 0
      setAttemptsRemaining(Math.max(0, challengeData.max_attempts - used))
      setIsLoading(false)
    }

    fetchChallenge()
  }, [challengeId, user, userRole])

  async function handleSubmit() {
    if (!challenge || !user || attemptsRemaining <= 0) return

    setIsSubmitting(true)
    setSubmissionResult(null)

    const responseJson = buildResponseJson()

    // Handle photo upload for photo_documentation type with dimension validation (Req 9.5, 9.6)
    let photoUrl: string | null = null
    if (challenge.type === 'photo_documentation' && photoFile) {
      // Validate dimensions before upload
      try {
        const dimensions = await getImageDimensions(photoFile)
        const validationResult = validateFileUpload(
          { type: photoFile.type, size: photoFile.size, width: dimensions.width, height: dimensions.height },
          'challenge_photo'
        )
        if (!validationResult.valid) {
          setSubmissionResult({ success: false, error: validationResult.error })
          setIsSubmitting(false)
          return
        }
      } catch {
        setSubmissionResult({ success: false, error: 'Failed to validate photo dimensions. Please try again.' })
        setIsSubmitting(false)
        return
      }

      const filePath = `submissions/${user.id}/${challenge.id}/${Date.now()}-${photoFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('challenge-photos')
        .upload(filePath, photoFile)

      if (uploadError) {
        setSubmissionResult({ success: false, error: 'Photo upload failed. Please try again.' })
        setIsSubmitting(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('challenge-photos')
        .getPublicUrl(filePath)

      photoUrl = urlData.publicUrl
    }

    // Determine initial status: auto-graded types start as 'pending' (updated to 'approved' after scoring),
    // review-requiring types (photo, interview, storytelling, reflection) stay 'pending' for review queue (Req 9.4)
    const isAutoGraded = challenge.type === 'trivia_quiz' || challenge.type === 'puzzle'

    const { data, error: submitError } = await supabase
      .from('submissions')
      .insert({
        user_id: user.id,
        challenge_id: challenge.id,
        response_json: responseJson,
        photo_url: photoUrl,
        status: 'pending',
        attempt_number: challenge.max_attempts - attemptsRemaining + 1,
      })
      .select()
      .single()

    if (submitError) {
      setSubmissionResult({ success: false, error: 'Submission failed. Please try again.' })
    } else if (isAutoGraded) {
      // Auto-grade trivia/puzzle and display result within 3 seconds (Req 9.7)
      const questions = getQuestions(challenge, constraints)
      const pointsPerQuestion = questions.length > 0
        ? challenge.points_reward / questions.length
        : 0
      const result = scoreQuiz(triviaAnswers, questions, pointsPerQuestion)
      const pointsAwarded = Math.round(result.score)

      // Update submission to approved with points
      await supabase
        .from('submissions')
        .update({ status: 'approved', points_awarded: pointsAwarded })
        .eq('id', data.id)

      // Award points immediately via points_ledger (Req 9.7)
      if (pointsAwarded > 0) {
        await supabase.from('points_ledger').insert({
          user_id: user.id,
          amount: pointsAwarded,
          reason: 'challenge_complete',
          reference_id: data.id,
        })

        // Update user's total points on profile
        await supabase.rpc('award_points', {
          p_user_id: user.id,
          p_amount: pointsAwarded,
          p_reason: 'challenge_complete',
          p_ref_id: data.id,
        }).then(() => {
          // Points awarded via RPC
        })
      }

      setSubmissionResult({
        success: true,
        points_awarded: pointsAwarded,
      })
      setAttemptsRemaining((prev) => Math.max(0, prev - 1))
    } else {
      // Review-requiring submissions stay in pending status for the review queue (Req 9.4)
      setSubmissionResult({ success: true })
      setAttemptsRemaining((prev) => Math.max(0, prev - 1))
    }

    setIsSubmitting(false)
  }

  function buildResponseJson() {
    switch (challenge?.type) {
      case 'trivia_quiz':
      case 'puzzle':
        return { answers: triviaAnswers }
      case 'photo_documentation':
        return { caption: textResponse }
      case 'observation':
      case 'reflection_journal':
      case 'interview':
      case 'storytelling':
        return { text: textResponse }
      default:
        return { text: textResponse }
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type and size (Req 9.5, 9.6)
    const basicValidation = validateFileUpload(
      { type: file.type, size: file.size },
      'challenge_photo'
    )
    if (!basicValidation.valid) {
      setError(basicValidation.error ?? 'Invalid file.')
      return
    }

    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading challenge...</p>
      </div>
    )
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'Challenge not found'}</p>
          <Link to="/app/map" className="text-primary hover:underline text-sm">
            Back to Map
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header>
          <Link
            to={`/app/sites/${challenge.heritage_site_id}`}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1 mb-4"
          >
            ← Back to Site
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{challenge.title}</h1>
          {challenge.description && (
            <p className="text-muted-foreground mt-2">{challenge.description}</p>
          )}
          <div className="flex gap-3 mt-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {formatChallengeType(challenge.type)}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              {challenge.difficulty}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {challenge.points_reward} pts
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Attempts remaining: {attemptsRemaining}
          </p>
        </header>

        {/* Submission Result */}
        {submissionResult && (
          <div
            className={`rounded-lg p-4 ${
              submissionResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
            role="alert"
          >
            {submissionResult.success ? (
              <div>
                <p className="font-semibold text-green-800">Submitted successfully!</p>
                {submissionResult.points_awarded !== undefined ? (
                  <p className="text-green-700 text-sm mt-1">
                    You earned {submissionResult.points_awarded} points!
                  </p>
                ) : (
                  <p className="text-green-700 text-sm mt-1">
                    Your response has been submitted for review.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-red-800">{submissionResult.error}</p>
            )}
          </div>
        )}

        {/* Challenge Content by Type */}
        {attemptsRemaining > 0 && !submissionResult?.success && (
          <div className="space-y-6">
            {renderChallengeContent(challenge, constraints, {
              triviaAnswers,
              setTriviaAnswers,
              textResponse,
              setTextResponse,
              photoFile,
              photoPreview,
              handlePhotoChange,
            })}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid(challenge, constraints, triviaAnswers, textResponse, photoFile)}
              className="w-full bg-primary text-white font-semibold py-3 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        )}

        {attemptsRemaining <= 0 && !submissionResult && (
          <div className="rounded-lg p-4 bg-muted text-center">
            <p className="text-muted-foreground font-medium">
              No attempts remaining for this challenge.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Rendering Helpers ──────────────────────────────────────────────────────────

interface FormState {
  triviaAnswers: Record<number, number>
  setTriviaAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>
  textResponse: string
  setTextResponse: React.Dispatch<React.SetStateAction<string>>
  photoFile: File | null
  photoPreview: string | null
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function renderChallengeContent(
  challenge: Challenge,
  constraints: ChallengeConstraints,
  formState: FormState
) {
  switch (challenge.type) {
    case 'trivia_quiz':
      return renderTriviaQuiz(challenge, constraints, formState)
    case 'puzzle':
      return renderPuzzle(challenge, constraints, formState)
    case 'observation':
      return renderTextChallenge(challenge, constraints, formState, 'Describe what you observe at this site:')
    case 'photo_documentation':
      return renderPhotoDocumentation(challenge, constraints, formState)
    case 'reflection_journal':
      return renderTextChallenge(challenge, constraints, formState, 'Write your reflection:')
    case 'interview':
      return renderTextChallenge(challenge, constraints, formState, 'Share what you learned from your interview:')
    case 'storytelling':
      return renderTextChallenge(challenge, constraints, formState, 'Tell your story:')
    default:
      return renderTextChallenge(challenge, constraints, formState, 'Your response:')
  }
}

function renderTriviaQuiz(
  challenge: Challenge,
  constraints: ChallengeConstraints,
  formState: FormState
) {
  const questions = getQuestions(challenge, constraints)

  return (
    <div className="space-y-6">
      {challenge.content_json.instructions && (
        <p className="text-foreground">{challenge.content_json.instructions}</p>
      )}
      {questions.map((q, index) => (
        <div key={index} className="space-y-3 p-4 rounded-lg bg-muted/50">
          <p className="font-medium text-foreground">
            {index + 1}. {q.question}
          </p>
          <div className="space-y-2" role="radiogroup" aria-label={`Question ${index + 1}`}>
            {q.options.map((option, optIdx) => (
              <label
                key={optIdx}
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  formState.triviaAnswers[index] === optIdx
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${index}`}
                  value={optIdx}
                  checked={formState.triviaAnswers[index] === optIdx}
                  onChange={() =>
                    formState.setTriviaAnswers((prev) => ({ ...prev, [index]: optIdx }))
                  }
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm text-foreground">{option}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function renderPuzzle(
  challenge: Challenge,
  constraints: ChallengeConstraints,
  formState: FormState
) {
  // Puzzles use same multiple-choice interface as trivia for Cub Scouts
  if (constraints.useMultipleChoice && challenge.content_json.questions) {
    return renderTriviaQuiz(challenge, constraints, formState)
  }

  // Standard puzzle view uses text response
  return renderTextChallenge(challenge, constraints, formState, 'Enter your puzzle solution:')
}

function renderTextChallenge(
  challenge: Challenge,
  constraints: ChallengeConstraints,
  formState: FormState,
  promptText: string
) {
  const prompt = challenge.content_json.prompt || promptText

  return (
    <div className="space-y-4">
      {challenge.content_json.instructions && (
        <p className="text-foreground">{challenge.content_json.instructions}</p>
      )}
      <label className="block">
        <span className="text-sm font-medium text-foreground">{prompt}</span>
        <textarea
          value={formState.textResponse}
          onChange={(e) => {
            const value = e.target.value.slice(0, constraints.maxTextLength)
            formState.setTextResponse(value)
          }}
          maxLength={constraints.maxTextLength}
          rows={constraints.maxTextLength <= 200 ? 4 : 6}
          className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          placeholder="Type your response here..."
        />
        <span className="text-xs text-muted-foreground mt-1 block text-right">
          {formState.textResponse.length}/{constraints.maxTextLength} characters
        </span>
      </label>
    </div>
  )
}

function renderPhotoDocumentation(
  challenge: Challenge,
  constraints: ChallengeConstraints,
  formState: FormState
) {
  return (
    <div className="space-y-4">
      {challenge.content_json.instructions && (
        <p className="text-foreground">{challenge.content_json.instructions}</p>
      )}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Upload your photo (JPEG or PNG, max 5 MB)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={formState.handlePhotoChange}
          className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
        />
        {formState.photoPreview && (
          <div className="mt-3">
            <img
              src={formState.photoPreview}
              alt="Photo preview"
              className="max-w-xs rounded-lg border border-border"
            />
          </div>
        )}
      </div>
      <label className="block">
        <span className="text-sm font-medium text-foreground">
          Caption (optional)
        </span>
        <textarea
          value={formState.textResponse}
          onChange={(e) => {
            const value = e.target.value.slice(0, constraints.maxTextLength)
            formState.setTextResponse(value)
          }}
          maxLength={constraints.maxTextLength}
          rows={3}
          className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          placeholder="Describe what you captured..."
        />
        <span className="text-xs text-muted-foreground mt-1 block text-right">
          {formState.textResponse.length}/{constraints.maxTextLength} characters
        </span>
      </label>
    </div>
  )
}

// ─── Utility Helpers ────────────────────────────────────────────────────────────

function formatChallengeType(type: ChallengeType): string {
  const labels: Record<ChallengeType, string> = {
    trivia_quiz: 'Trivia Quiz',
    observation: 'Observation',
    photo_documentation: 'Photo Documentation',
    puzzle: 'Puzzle',
    reflection_journal: 'Reflection Journal',
    interview: 'Interview',
    storytelling: 'Storytelling',
  }
  return labels[type] || type
}

function getQuestions(challenge: Challenge, constraints: ChallengeConstraints): TriviaQuestion[] {
  const questions = challenge.content_json.questions || []
  return questions.slice(0, constraints.maxTriviaQuestions)
}

function isFormValid(
  challenge: Challenge,
  constraints: ChallengeConstraints,
  triviaAnswers: Record<number, number>,
  textResponse: string,
  photoFile: File | null
): boolean {
  switch (challenge.type) {
    case 'trivia_quiz':
    case 'puzzle': {
      if (constraints.useMultipleChoice || challenge.content_json.questions) {
        const questions = getQuestions(challenge, constraints)
        return questions.every((_, idx) => triviaAnswers[idx] !== undefined)
      }
      return textResponse.trim().length > 0
    }
    case 'photo_documentation':
      return photoFile !== null
    case 'observation':
    case 'reflection_journal':
    case 'interview':
    case 'storytelling':
      return textResponse.trim().length > 0
    default:
      return textResponse.trim().length > 0
  }
}
