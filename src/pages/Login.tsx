import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, sessionExpired, setSessionExpired } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Message from registration or session expiry
  const locationMessage = (location.state as { message?: string })?.message ?? null

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app/passport', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Clear session expired flag when user visits login page
  useEffect(() => {
    if (sessionExpired) {
      setSessionExpired(false)
    }
  }, [sessionExpired, setSessionExpired])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    if (!password) {
      setError('Please enter your password')
      return
    }

    setIsSubmitting(true)

    try {
      const { error: loginError } = await login(email, password)

      if (loginError) {
        setError(loginError)
        return
      }

      // Successful login - redirect to Digital Passport (Req 2.1)
      navigate('/app/passport', { replace: true })
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">Welcome Back</h1>
          <p className="text-muted-foreground">
            Sign in to your ScoutChase account
          </p>
        </div>

        {/* Session expired message (Req 2.6) */}
        {sessionExpired && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3" role="alert">
            <p className="text-sm text-amber-800">
              Your session has expired. Please sign in again.
            </p>
          </div>
        )}

        {/* Location message (from registration, etc.) */}
        {locationMessage && !sessionExpired && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3" role="status">
            <p className="text-sm text-green-800">{locationMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
              autoComplete="current-password"
            />
          </div>

          {/* Error message (Req 2.2 - generic message) */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3" role="alert">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <Link
            to="/reset-password"
            className="text-sm text-primary hover:underline"
          >
            Forgot your password?
          </Link>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
