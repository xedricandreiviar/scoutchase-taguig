import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  validateRegistration,
  SCOUT_SECTIONS,
  type RegistrationInput,
  type RegistrationErrors,
} from '@/lib/validators/registration'
import { assignRole } from '@/lib/auth/role-assignment'
import { supabase } from '@/lib/supabase'

export default function Register() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState<RegistrationInput>({
    full_name: '',
    email: '',
    password: '',
    age: '',
    scout_section: '',
    troop_unit_number: '',
    school: '',
    guardian_email: '',
  })

  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [roleMessage, setRoleMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const parsedAge =
    typeof formData.age === 'string'
      ? parseInt(formData.age, 10)
      : formData.age

  const showGuardianEmail = !isNaN(parsedAge) && parsedAge >= 7 && parsedAge < 12

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear the specific field error on change
    if (errors[name as keyof RegistrationErrors]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name as keyof RegistrationErrors]
        return next
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const result = validateRegistration(formData)

    if (!result.valid) {
      setErrors(result.errors)
      return
    }

    // Clear errors on successful validation
    setErrors({})
    setIsSubmitting(true)

    try {
      // Derive role from registration data
      const { role, message: roleMsg } = assignRole(
        formData.scout_section,
        formData.troop_unit_number?.trim() || undefined
      )

      if (roleMsg) {
        setRoleMessage(roleMsg)
      }

      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name.trim(),
            age: parsedAge,
            scout_section: formData.scout_section,
            troop_unit_number: formData.troop_unit_number?.trim() || null,
            school: formData.school?.trim() || null,
            guardian_email: formData.guardian_email?.trim() || null,
            role,
          },
        },
      })

      if (error) {
        setSubmitError(error.message)
        return
      }

      if (data.user) {
        navigate('/login', {
          state: {
            message: roleMsg
              ? `Registration successful! ${roleMsg} Please check your email to verify your account.`
              : 'Registration successful! Please check your email to verify your account.',
          },
        })
      }
    } catch {
      setSubmitError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">Join ScoutChase</h1>
          <p className="text-muted-foreground">
            Create your account to start exploring Taguig&apos;s heritage
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Full Name */}
          <div className="space-y-1">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              placeholder="Enter your full name"
              value={formData.full_name}
              onChange={handleChange}
              aria-invalid={!!errors.full_name}
              aria-describedby={errors.full_name ? 'full_name-error' : undefined}
            />
            {errors.full_name && (
              <p id="full_name-error" className="text-sm text-destructive" role="alert">
                {errors.full_name}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Minimum 8 characters"
              value={formData.password}
              onChange={handleChange}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && (
              <p id="password-error" className="text-sm text-destructive" role="alert">
                {errors.password}
              </p>
            )}
          </div>

          {/* Age */}
          <div className="space-y-1">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              name="age"
              type="number"
              min={7}
              max={99}
              placeholder="7-99"
              value={formData.age}
              onChange={handleChange}
              aria-invalid={!!errors.age}
              aria-describedby={errors.age ? 'age-error' : undefined}
            />
            {errors.age && (
              <p id="age-error" className="text-sm text-destructive" role="alert">
                {errors.age}
              </p>
            )}
          </div>

          {/* Scout Section */}
          <div className="space-y-1">
            <Label htmlFor="scout_section">Scout Section</Label>
            <Select
              id="scout_section"
              name="scout_section"
              value={formData.scout_section}
              onChange={handleChange}
              aria-invalid={!!errors.scout_section}
              aria-describedby={
                errors.scout_section ? 'scout_section-error' : undefined
              }
            >
              <option value="">Select your section</option>
              {SCOUT_SECTIONS.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </Select>
            {errors.scout_section && (
              <p
                id="scout_section-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.scout_section}
              </p>
            )}
          </div>

          {/* Troop/Unit Number (optional) */}
          <div className="space-y-1">
            <Label htmlFor="troop_unit_number">
              Troop/Unit Number{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="troop_unit_number"
              name="troop_unit_number"
              type="text"
              placeholder="e.g. Troop42"
              value={formData.troop_unit_number}
              onChange={handleChange}
              aria-invalid={!!errors.troop_unit_number}
              aria-describedby={
                errors.troop_unit_number ? 'troop_unit_number-error' : undefined
              }
            />
            {errors.troop_unit_number && (
              <p
                id="troop_unit_number-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.troop_unit_number}
              </p>
            )}
          </div>

          {/* School (optional) */}
          <div className="space-y-1">
            <Label htmlFor="school">
              School{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="school"
              name="school"
              type="text"
              placeholder="Your school name"
              value={formData.school}
              onChange={handleChange}
            />
          </div>

          {/* Guardian Email (conditional: required for age < 12) */}
          {showGuardianEmail && (
            <div className="space-y-1">
              <Label htmlFor="guardian_email">Guardian Email</Label>
              <p className="text-xs text-muted-foreground">
                Required for users under 12 years old
              </p>
              <Input
                id="guardian_email"
                name="guardian_email"
                type="email"
                placeholder="guardian@example.com"
                value={formData.guardian_email}
                onChange={handleChange}
                aria-invalid={!!errors.guardian_email}
                aria-describedby={
                  errors.guardian_email ? 'guardian_email-error' : undefined
                }
              />
              {errors.guardian_email && (
                <p
                  id="guardian_email-error"
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {errors.guardian_email}
                </p>
              )}
            </div>
          )}

          {/* Role Message */}
          {roleMessage && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3" role="status">
              <p className="text-sm text-amber-800">{roleMessage}</p>
            </div>
          )}

          {/* Submit Error */}
          {submitError && (
            <div className="rounded-md bg-destructive/10 p-3" role="alert">
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
