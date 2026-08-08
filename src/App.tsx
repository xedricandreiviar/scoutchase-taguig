import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { OfflineIndicator } from '@/components/OfflineIndicator'

// Lazy-loaded page components for route-level code splitting (Req 19.5)
const Register = lazy(() => import('@/pages/Register'))
const Login = lazy(() => import('@/pages/Login'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const Passport = lazy(() => import('@/pages/Passport'))
const Map = lazy(() => import('@/pages/Map'))
const Scan = lazy(() => import('@/pages/Scan'))
const SiteContent = lazy(() => import('@/pages/SiteContent'))
const ChallengeAttempt = lazy(() => import('@/pages/ChallengeAttempt'))
const Trails = lazy(() => import('@/pages/Trails'))
const TrailDetail = lazy(() => import('@/pages/TrailDetail'))
const Leaderboard = lazy(() => import('@/pages/Leaderboard'))
const ServiceMissions = lazy(() => import('@/pages/ServiceMissions'))
const ServiceLogForm = lazy(() => import('@/pages/ServiceLogForm'))
const ReviewQueue = lazy(() => import('@/pages/admin/ReviewQueue'))
const AdminPartners = lazy(() => import('@/pages/admin/Partners'))
const AdminSiteEditor = lazy(() => import('@/pages/admin/SiteEditor'))
const AdminTrails = lazy(() => import('@/pages/admin/Trails'))
const AdminChallenges = lazy(() => import('@/pages/admin/Challenges'))
const AdminMissions = lazy(() => import('@/pages/admin/Missions'))
const AdminBadges = lazy(() => import('@/pages/admin/Badges'))
const AdminUsers = lazy(() => import('@/pages/admin/Users'))
const AdminAnnouncements = lazy(() => import('@/pages/admin/Announcements'))
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminQRCodes = lazy(() => import('@/pages/admin/QRCodes'))
const JoinScouting = lazy(() => import('@/pages/JoinScouting'))
const Partners = lazy(() => import('@/pages/Partners'))
const Referral = lazy(() => import('@/pages/Referral'))
const Events = lazy(() => import('@/pages/Events'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const GroupTrails = lazy(() => import('@/pages/GroupTrails'))
const GroupTrailDetail = lazy(() => import('@/pages/GroupTrailDetail'))
const Mentoring = lazy(() => import('@/pages/Mentoring'))
const AdminEvents = lazy(() => import('@/pages/admin/Events'))

/** Loading fallback for lazy-loaded routes */
function PageLoader() {
  return (
    <div className="lazy-loading-spinner" role="status" aria-label="Loading page">
      <div className="text-center space-y-2">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-forest-green text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold">
            ScoutChase Taguig
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Heritage exploration and community engagement platform for the Boy Scouts of the Philippines — Taguig City Council
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <a
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3 bg-bsp-gold text-black font-semibold rounded-lg hover:bg-bsp-gold/90 transition-colors min-h-[44px]"
            >
              Get Started
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors min-h-[44px]"
            >
              Sign In
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
            Explore, Serve, Achieve
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-3 p-6 rounded-lg border border-border">
              <div className="text-4xl">🗺️</div>
              <h3 className="text-lg font-semibold text-foreground">Heritage Trails</h3>
              <p className="text-sm text-muted-foreground">
                Discover Taguig's rich history through themed trails. Scan QR codes at heritage sites to unlock content and earn points.
              </p>
            </div>
            <div className="text-center space-y-3 p-6 rounded-lg border border-border">
              <div className="text-4xl">🤝</div>
              <h3 className="text-lg font-semibold text-foreground">Community Service</h3>
              <p className="text-sm text-muted-foreground">
                Log service hours, participate in clean-up drives, tree planting, and heritage documentation missions.
              </p>
            </div>
            <div className="text-center space-y-3 p-6 rounded-lg border border-border">
              <div className="text-4xl">🏆</div>
              <h3 className="text-lg font-semibold text-foreground">Badges & Leaderboard</h3>
              <p className="text-sm text-muted-foreground">
                Earn digital badges, climb the leaderboard, and build your Digital Passport with achievements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4 bg-muted/50">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Ready to explore?</h2>
          <p className="text-muted-foreground">
            Join thousands of scouts discovering Taguig's heritage sites, completing challenges, and serving the community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/join-scouting"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors min-h-[44px]"
            >
              Join Scouting
            </a>
            <a
              href="/partners"
              className="inline-flex items-center justify-center px-6 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors min-h-[44px]"
            >
              Our Partners
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t text-center">
        <p className="text-sm text-muted-foreground">
          ScoutChase Taguig — A BSP Taguig City Council Initiative
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-4">
          <a href="/login" className="text-sm text-primary hover:underline">Sign In</a>
          <a href="/register" className="text-sm text-primary hover:underline">Register</a>
          <a href="/join-scouting" className="text-sm text-primary hover:underline">Join Scouting</a>
          <a href="/partners" className="text-sm text-primary hover:underline">Partners</a>
        </div>
      </footer>
    </div>
  )
}

/** Authenticated app shell — redirects to login if unauthenticated */
function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/** Handles session expiry redirect (Req 2.6) */
function SessionExpiryHandler() {
  const navigate = useNavigate()
  const { sessionExpired, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (sessionExpired && !isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [sessionExpired, isAuthenticated, navigate])

  return null
}

function App() {
  const { initialize } = useAuthStore()

  // Initialize auth session on app mount (Req 2.5 - session persistence)
  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      {/* Req 20.3: Skip-to-content link for keyboard navigation */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <OfflineIndicator />
      <SessionExpiryHandler />
      <main id="main-content" role="main">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/join-scouting" element={<JoinScouting />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/app/passport" element={<AppShell><Passport /></AppShell>} />
          <Route path="/app/map" element={<AppShell><div className="h-screen"><Map /></div></AppShell>} />
          <Route path="/app/scan" element={<AppShell><Scan /></AppShell>} />
          <Route path="/app/sites/:siteId" element={<AppShell><SiteContent /></AppShell>} />
          <Route path="/app/challenges/:challengeId" element={<AppShell><ChallengeAttempt /></AppShell>} />
          <Route path="/app/trails" element={<AppShell><Trails /></AppShell>} />
          <Route path="/app/trails/:trailId" element={<AppShell><TrailDetail /></AppShell>} />
          <Route path="/app/leaderboard" element={<AppShell><Leaderboard /></AppShell>} />
          <Route path="/app/service" element={<AppShell><ServiceMissions /></AppShell>} />
          <Route path="/app/service/log" element={<AppShell><ServiceLogForm /></AppShell>} />
          <Route path="/app/referral" element={<AppShell><Referral /></AppShell>} />
          <Route path="/app/events" element={<AppShell><Events /></AppShell>} />
          <Route path="/app/notifications" element={<AppShell><Notifications /></AppShell>} />
          <Route path="/app/group-trails" element={<AppShell><GroupTrails /></AppShell>} />
          <Route path="/app/group-trails/:attemptId" element={<AppShell><GroupTrailDetail /></AppShell>} />
          <Route path="/app/mentoring" element={<AppShell><Mentoring /></AppShell>} />
          <Route path="/app/review-queue" element={<AppShell><ReviewQueue /></AppShell>} />
          <Route path="/admin/review-queue" element={<AppShell><ReviewQueue /></AppShell>} />
          <Route path="/admin/dashboard" element={<AppShell><AdminDashboard /></AppShell>} />
          <Route path="/admin/partners" element={<AppShell><AdminPartners /></AppShell>} />
          <Route path="/admin/sites" element={<AppShell><AdminSiteEditor /></AppShell>} />
          <Route path="/admin/trails" element={<AppShell><AdminTrails /></AppShell>} />
          <Route path="/admin/challenges" element={<AppShell><AdminChallenges /></AppShell>} />
          <Route path="/admin/missions" element={<AppShell><AdminMissions /></AppShell>} />
          <Route path="/admin/badges" element={<AppShell><AdminBadges /></AppShell>} />
          <Route path="/admin/users" element={<AppShell><AdminUsers /></AppShell>} />
          <Route path="/admin/announcements" element={<AppShell><AdminAnnouncements /></AppShell>} />
          <Route path="/admin/events" element={<AppShell><AdminEvents /></AppShell>} />
          <Route path="/admin/qr-codes" element={<AppShell><AdminQRCodes /></AppShell>} />
          <Route path="/app/*" element={<AppShell><Passport /></AppShell>} />
        </Routes>
      </Suspense>
      </main>
    </BrowserRouter>
  )
}

export default App
