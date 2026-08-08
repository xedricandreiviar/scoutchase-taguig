import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'

/**
 * Local units data for Taguig City Council.
 * In production this could be fetched from the database, but for now
 * it's hardcoded per the BSP Taguig City Council structure.
 */
const LOCAL_UNITS = [
  {
    id: '1',
    name: 'Taguig City Council – Unit 1',
    meeting_location: 'Signal Village Elementary School, Signal Village, Taguig City',
    contact: 'taguig.unit1@bsp.org.ph',
    section: 'Cub Scout & Boy Scout',
  },
  {
    id: '2',
    name: 'Taguig City Council – Unit 2',
    meeting_location: 'Taguig National High School, Upper Bicutan, Taguig City',
    contact: 'taguig.unit2@bsp.org.ph',
    section: 'Boy Scout & Senior Scout',
  },
  {
    id: '3',
    name: 'Taguig City Council – Unit 3',
    meeting_location: 'Bagumbayan Elementary School, Bagumbayan, Taguig City',
    contact: 'taguig.unit3@bsp.org.ph',
    section: 'Cub Scout, Boy Scout & Rover Scout',
  },
  {
    id: '4',
    name: 'Taguig City Council – Unit 4',
    meeting_location: 'Tipas Elementary School, Tipas, Taguig City',
    contact: 'taguig.unit4@bsp.org.ph',
    section: 'Cub Scout & Boy Scout',
  },
  {
    id: '5',
    name: 'Taguig City Council – Unit 5',
    meeting_location: 'Ususan Elementary School, Ususan, Taguig City',
    contact: 'taguig.unit5@bsp.org.ph',
    section: 'All Sections',
  },
]

/**
 * Public "Join Scouting" page accessible without authentication.
 * Displays BSP description, local units, and CTA for introductory challenge.
 *
 * Also handles the "Ready to become a Scout?" prompt after
 * introductory challenge completion.
 *
 * Validates: Requirements 12.1, 12.2
 */
export default function JoinScouting() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [showScoutPrompt, setShowScoutPrompt] = useState(false)
  const [nearestUnit, setNearestUnit] = useState(LOCAL_UNITS[0])

  // Check if user just completed the introductory challenge (Req 12.2)
  const challengeCompleted = searchParams.get('intro_complete') === 'true'

  useEffect(() => {
    if (challengeCompleted) {
      // Show the "Ready to become a Scout?" prompt within 3 seconds of completion
      const timer = setTimeout(() => {
        setShowScoutPrompt(true)
        // Pick nearest unit (for now, use first unit as default)
        setNearestUnit(LOCAL_UNITS[0])
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [challengeCompleted])

  // Store referral code in session storage for registration attribution (Req 12.3, 12.4)
  useEffect(() => {
    const referralCode = searchParams.get('ref')
    if (referralCode) {
      sessionStorage.setItem('scoutchase_referral_code', referralCode)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-primary text-primary-foreground py-16 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold">
            Join the Boy Scouts of the Philippines
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Discover Taguig's heritage, serve your community, and grow as a leader
            through scouting adventures.
          </p>
        </div>
      </section>

      {/* BSP Description Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-foreground">
            What is BSP Scouting?
          </h2>
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-4">
            <p>
              The Boy Scouts of the Philippines (BSP) is the national scouting
              organization that develops young Filipinos into responsible citizens
              through outdoor activities, community service, and character-building
              programs.
            </p>
            <p>
              BSP Scouting in Taguig City combines heritage exploration with
              community engagement. Through ScoutChase, scouts and aspiring scouts
              discover historical landmarks, complete challenges, earn badges, and
              contribute to meaningful service missions that benefit our community.
            </p>
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="bg-card rounded-lg border p-4 text-center space-y-2">
                <div className="text-3xl" aria-hidden="true">🏕️</div>
                <h3 className="font-semibold text-foreground">Adventure</h3>
                <p className="text-sm">
                  Explore heritage sites, complete trails, and discover Taguig's rich
                  history through exciting challenges.
                </p>
              </div>
              <div className="bg-card rounded-lg border p-4 text-center space-y-2">
                <div className="text-3xl" aria-hidden="true">🤝</div>
                <h3 className="font-semibold text-foreground">Service</h3>
                <p className="text-sm">
                  Participate in community service missions like clean-up drives,
                  tree planting, and heritage documentation.
                </p>
              </div>
              <div className="bg-card rounded-lg border p-4 text-center space-y-2">
                <div className="text-3xl" aria-hidden="true">🏆</div>
                <h3 className="font-semibold text-foreground">Achievement</h3>
                <p className="text-sm">
                  Earn digital badges, climb leaderboards, and build a portfolio of
                  accomplishments through your Digital Passport.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scout Sections */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-foreground">
            Scout Sections
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-card rounded-lg border p-4 space-y-1">
              <h3 className="font-semibold text-foreground">🐻 Cub Scouts</h3>
              <p className="text-sm text-muted-foreground">Ages 6–11 • Fun, games, and first adventures</p>
            </div>
            <div className="bg-card rounded-lg border p-4 space-y-1">
              <h3 className="font-semibold text-foreground">⚜️ Boy Scouts</h3>
              <p className="text-sm text-muted-foreground">Ages 12–17 • Full trail access and service missions</p>
            </div>
            <div className="bg-card rounded-lg border p-4 space-y-1">
              <h3 className="font-semibold text-foreground">🌟 Senior Scouts</h3>
              <p className="text-sm text-muted-foreground">Ages 15–17 • Group trail leadership</p>
            </div>
            <div className="bg-card rounded-lg border p-4 space-y-1">
              <h3 className="font-semibold text-foreground">🧭 Rover Scouts</h3>
              <p className="text-sm text-muted-foreground">Ages 18–25 • Mentoring and community leadership</p>
            </div>
          </div>
        </div>
      </section>

      {/* Local Units Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-foreground">
            Local Units in Taguig City
          </h2>
          <p className="text-muted-foreground">
            Find a unit near you and start your scouting journey today.
          </p>
          <div className="space-y-4">
            {LOCAL_UNITS.map((unit) => (
              <div
                key={unit.id}
                className="bg-card rounded-lg border p-4 space-y-2"
              >
                <h3 className="font-semibold text-foreground">{unit.name}</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Meeting Location:</span>{' '}
                    {unit.meeting_location}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Contact:</span>{' '}
                    <a
                      href={`mailto:${unit.contact}`}
                      className="text-primary hover:underline"
                    >
                      {unit.contact}
                    </a>
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Sections:</span>{' '}
                    {unit.section}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action - Introductory Challenge */}
      <section className="py-16 px-4 bg-primary/5 border-t">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold text-foreground">
            Try the Introductory Challenge
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Not sure if scouting is for you? Try our introductory heritage
            challenge and experience what ScoutChase has to offer — no
            registration required!
          </p>
          {isAuthenticated ? (
            <Button
              size="lg"
              onClick={() => navigate('/app/passport')}
              className="text-lg px-8 py-3"
            >
              Go to Your Passport
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => navigate('/register')}
                className="text-lg px-8 py-3"
              >
                Start Introductory Challenge
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/register')}
                className="text-lg px-8 py-3"
              >
                Create an Account
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* "Ready to become a Scout?" Prompt (Req 12.2) */}
      {showScoutPrompt && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scout-prompt-title"
        >
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2
              id="scout-prompt-title"
              className="text-xl font-bold text-foreground text-center"
            >
              🎉 Ready to become a Scout?
            </h2>
            <p className="text-muted-foreground text-center">
              Great job completing the introductory challenge! Here&apos;s how you can
              join a scouting unit near you:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-foreground">
                {nearestUnit.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Location:</span>{' '}
                {nearestUnit.meeting_location}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Contact:</span>{' '}
                <a
                  href={`mailto:${nearestUnit.contact}`}
                  className="text-primary hover:underline"
                >
                  {nearestUnit.contact}
                </a>
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">
                Next Steps:
              </p>
              <ol className="text-sm text-muted-foreground list-decimal pl-4 space-y-1">
                <li>Contact the unit above or visit during their meeting time</li>
                <li>Register on ScoutChase with your troop/unit number</li>
                <li>Start exploring trails and earning badges!</li>
              </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {!isAuthenticated ? (
                <Button
                  className="flex-1"
                  onClick={() => navigate('/register')}
                >
                  Register Now
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={() => navigate('/app/passport')}
                >
                  Go to Passport
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowScoutPrompt(false)}
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 px-4 border-t text-center">
        <p className="text-sm text-muted-foreground">
          ScoutChase Taguig — A BSP Taguig City Council Initiative
        </p>
        <div className="mt-2 space-x-4">
          <Link to="/login" className="text-sm text-primary hover:underline">
            Sign In
          </Link>
          <Link to="/register" className="text-sm text-primary hover:underline">
            Register
          </Link>
        </div>
      </footer>
    </div>
  )
}
