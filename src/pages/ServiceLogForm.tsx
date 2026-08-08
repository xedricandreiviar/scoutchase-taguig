import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { validateServiceLog } from '@/lib/validators/service-log'
import type { ServiceLogInput } from '@/lib/validators/service-log'

interface MissionOption {
  id: string
  name: string
  trail_name: string
}

/**
 * Service Log Form page.
 * Allows users to log community service hours for a selected mission.
 * Submitted logs are placed in the review queue with status "pending_verification".
 *
 * Validates: Requirements 10.2, 10.3
 */
export default function ServiceLogForm() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [missions, setMissions] = useState<MissionOption[]>([])
  const [loadingMissions, setLoadingMissions] = useState(true)

  const [missionId, setMissionId] = useState('')
  const [description, setDescription] = useState('')
  const [durationHours, setDurationHours] = useState<number>(0.5)
  const [datePerformed, setDatePerformed] = useState('')
  const [photoProof, setPhotoProof] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Load available missions
  const loadMissions = useCallback(async () => {
    setLoadingMissions(true)
    try {
      const { data, error } = await supabase
        .from('service_missions')
        .select(`
          id,
          name,
          trails ( name )
        `)
        .eq('is_active', true)
        .order('name')

      if (error) throw new Error(error.message)

      setMissions(
        (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          trail_name: row.trails?.name ?? 'Unknown Trail',
        }))
      )
    } catch {
      // Silently fail – user can still fill form if missions don't load
      setMissions([])
    } finally {
      setLoadingMissions(false)
    }
  }, [])

  useEffect(() => {
    loadMissions()
  }, [loadMissions])

  // Get today's date in YYYY-MM-DD format for the max attribute
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Generate duration options (0.5 to 24 in 0.5 increments)
  const durationOptions: number[] = []
  for (let d = 0.5; d <= 24; d += 0.5) {
    durationOptions.push(d)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhotoProof(file)

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }

    if (file) {
      setPhotoPreview(URL.createObjectURL(file))
    } else {
      setPhotoPreview(null)
    }
  }

  function removePhoto() {
    setPhotoProof(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const input: ServiceLogInput = {
      description,
      duration_hours: durationHours,
      date_performed: datePerformed,
      mission_id: missionId,
      photo_proof: photoProof,
    }

    // Validate input
    const result = validateServiceLog(input)
    setErrors(result.errors)

    if (!result.valid) {
      return
    }

    if (!user?.id) {
      setSubmitError('You must be logged in to submit a service log.')
      return
    }

    setSubmitting(true)

    try {
      // Upload photo if provided
      let photoUrl: string | null = null
      if (photoProof) {
        const fileExt = photoProof.name.split('.').pop()
        const filePath = `service-proofs/${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, photoProof, {
            contentType: photoProof.type,
          })

        if (uploadError) {
          throw new Error(`Photo upload failed: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath)

        photoUrl = urlData.publicUrl
      }

      // Insert service log with status "pending_verification" (Req 10.3)
      const { error: insertError } = await supabase
        .from('service_logs')
        .insert({
          user_id: user.id,
          mission_id: missionId,
          description: description.trim(),
          duration_hours: durationHours,
          date_performed: datePerformed,
          photo_url: photoUrl,
          status: 'pending_verification',
          attempt_number: 1,
          max_attempts: 3,
        })

      if (insertError) {
        throw new Error(insertError.message)
      }

      // Navigate back to service missions on success
      navigate('/app/service', { replace: true })
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Failed to submit service log. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-primary">Log Service Hours</h1>
        <p className="text-muted-foreground">
          Record your community service activity. Your log will be reviewed for verification.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Mission Selection */}
          <div className="space-y-1.5">
            <label htmlFor="mission" className="block text-sm font-medium text-foreground">
              Service Mission <span className="text-destructive">*</span>
            </label>
            {loadingMissions ? (
              <p className="text-sm text-muted-foreground">Loading missions...</p>
            ) : (
              <select
                id="mission"
                value={missionId}
                onChange={(e) => setMissionId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-describedby={errors.mission_id ? 'mission-error' : undefined}
                aria-invalid={!!errors.mission_id}
              >
                <option value="">Select a mission...</option>
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.trail_name})
                  </option>
                ))}
              </select>
            )}
            {errors.mission_id && (
              <p id="mission-error" className="text-sm text-destructive" role="alert">
                {errors.mission_id}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="block text-sm font-medium text-foreground">
              Description <span className="text-destructive">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the service activity you performed (20-500 characters)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              aria-describedby={errors.description ? 'description-error' : 'description-hint'}
              aria-invalid={!!errors.description}
              maxLength={500}
            />
            <div className="flex justify-between items-center">
              <p id="description-hint" className="text-xs text-muted-foreground">
                {description.trim().length}/500 characters (min 20)
              </p>
            </div>
            {errors.description && (
              <p id="description-error" className="text-sm text-destructive" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label htmlFor="duration" className="block text-sm font-medium text-foreground">
              Duration (hours) <span className="text-destructive">*</span>
            </label>
            <select
              id="duration"
              value={durationHours}
              onChange={(e) => setDurationHours(parseFloat(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-describedby={errors.duration_hours ? 'duration-error' : undefined}
              aria-invalid={!!errors.duration_hours}
            >
              {durationOptions.map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? 'hour' : 'hours'}
                </option>
              ))}
            </select>
            {errors.duration_hours && (
              <p id="duration-error" className="text-sm text-destructive" role="alert">
                {errors.duration_hours}
              </p>
            )}
          </div>

          {/* Date Performed */}
          <div className="space-y-1.5">
            <label htmlFor="date-performed" className="block text-sm font-medium text-foreground">
              Date Performed <span className="text-destructive">*</span>
            </label>
            <input
              id="date-performed"
              type="date"
              value={datePerformed}
              onChange={(e) => setDatePerformed(e.target.value)}
              max={todayStr}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-describedby={errors.date_performed ? 'date-error' : undefined}
              aria-invalid={!!errors.date_performed}
            />
            {errors.date_performed && (
              <p id="date-error" className="text-sm text-destructive" role="alert">
                {errors.date_performed}
              </p>
            )}
          </div>

          {/* Photo Proof (optional) */}
          <div className="space-y-1.5">
            <label htmlFor="photo-proof" className="block text-sm font-medium text-foreground">
              Photo Proof <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <input
              ref={fileInputRef}
              id="photo-proof"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handlePhotoChange}
              className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              aria-describedby={errors.photo_proof ? 'photo-error' : 'photo-hint'}
              aria-invalid={!!errors.photo_proof}
            />
            <p id="photo-hint" className="text-xs text-muted-foreground">
              JPEG or PNG, max 5MB
            </p>
            {errors.photo_proof && (
              <p id="photo-error" className="text-sm text-destructive" role="alert">
                {errors.photo_proof}
              </p>
            )}
            {photoPreview && (
              <div className="mt-2 space-y-2">
                <img
                  src={photoPreview}
                  alt="Photo proof preview"
                  className="w-32 h-32 object-cover rounded-md border"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-sm text-destructive hover:underline"
                >
                  Remove photo
                </button>
              </div>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20" role="alert">
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/app/service')}
              className="flex-1 px-4 py-2 border border-input rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Service Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
