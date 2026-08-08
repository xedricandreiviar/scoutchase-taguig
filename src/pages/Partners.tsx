/**
 * Public Partners page listing all supporting organizations.
 *
 * Displays partners alphabetically with logo (max 500KB, 80px height),
 * name, and description (max 200 chars).
 *
 * Validates: Requirements 13.1
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { sortPartnersAlphabetically, type Partner } from '@/lib/partners/sort'

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPartners() {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('partners')
        .select('*')
        .eq('is_active', true)

      if (fetchError) {
        setError('Failed to load partners. Please try again later.')
        setIsLoading(false)
        return
      }

      setPartners(sortPartnersAlphabetically(data || []))
      setIsLoading(false)
    }

    fetchPartners()

    // Subscribe to realtime changes for partners table
    // so updates are reflected within 60 seconds (Req 13.2)
    const channel = supabase
      .channel('partners-public')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partners' },
        () => {
          // Refetch on any change
          fetchPartners()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading partners...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-primary text-primary-foreground py-12 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">Our Partners</h1>
          <p className="text-lg opacity-90 max-w-2xl mx-auto">
            Supporting organizations that make ScoutChase Taguig possible.
          </p>
        </div>
      </section>

      {/* Partners List */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div
              className="rounded-lg p-4 bg-red-50 border border-red-200 text-red-800 text-sm mb-6"
              role="alert"
            >
              {error}
            </div>
          )}

          {partners.length === 0 && !error ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No partner organizations to display at this time.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="rounded-lg border border-border bg-card p-6 space-y-4 flex flex-col items-center text-center"
                >
                  <div className="h-[80px] flex items-center justify-center">
                    <img
                      src={partner.logo_url}
                      alt={`${partner.name} logo`}
                      className="max-h-[80px] w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <h2 className="font-semibold text-foreground text-lg">
                    {partner.name}
                  </h2>
                  {partner.description && (
                    <p className="text-sm text-muted-foreground line-clamp-4">
                      {partner.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t text-center">
        <p className="text-sm text-muted-foreground">
          ScoutChase Taguig — A BSP Taguig City Council Initiative
        </p>
        <div className="mt-2 space-x-4">
          <Link to="/" className="text-sm text-primary hover:underline">
            Home
          </Link>
          <Link to="/join-scouting" className="text-sm text-primary hover:underline">
            Join Scouting
          </Link>
        </div>
      </footer>
    </div>
  )
}
