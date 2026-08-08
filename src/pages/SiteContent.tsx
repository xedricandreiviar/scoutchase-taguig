import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { parseRichTextToHtml, isValidRichTextDocument } from '@/lib/content/rich-text-parser'
import { sanitizeHtml } from '@/lib/content/sanitizer'
import type { RichTextDocument } from '@/lib/content/rich-text-parser'

interface TimelineEntry {
  year: string
  event: string
}

interface HeritageSiteData {
  id: string
  name: string
  description: string | null
  content_json: RichTextDocument | null
  photo_gallery: string[]
  audio_url: string | null
  video_url: string | null
  timeline: TimelineEntry[]
  trail_id: string | null
}

type MediaErrorState = Record<string, boolean>

export default function SiteContent() {
  const { siteId } = useParams<{ siteId: string }>()
  const [site, setSite] = useState<HeritageSiteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mediaErrors, setMediaErrors] = useState<MediaErrorState>({})

  useEffect(() => {
    if (!siteId) return

    async function fetchSite() {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('heritage_sites')
        .select('id, name, description, content_json, photo_gallery, audio_url, video_url, timeline, trail_id')
        .eq('id', siteId)
        .eq('is_active', true)
        .single()

      if (fetchError || !data) {
        setError('Heritage site not found or unavailable.')
        setIsLoading(false)
        return
      }

      setSite({
        id: data.id,
        name: data.name,
        description: data.description,
        content_json: data.content_json as RichTextDocument | null,
        photo_gallery: (data.photo_gallery as string[]) || [],
        audio_url: data.audio_url,
        video_url: data.video_url,
        timeline: (data.timeline as TimelineEntry[]) || [],
        trail_id: data.trail_id,
      })
      setIsLoading(false)
    }

    fetchSite()
  }, [siteId])

  function handleMediaError(key: string) {
    setMediaErrors((prev) => ({ ...prev, [key]: true }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading heritage site...</p>
      </div>
    )
  }

  if (error || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'Site not found'}</p>
          <Link to="/app/map" className="text-primary hover:underline text-sm">
            Back to Map
          </Link>
        </div>
      </div>
    )
  }

  // Parse rich-text content to HTML
  const contentHtml = site.content_json && isValidRichTextDocument(site.content_json)
    ? sanitizeHtml(parseRichTextToHtml(site.content_json))
    : null

  // Limit display to max 2000 chars of description
  const description = site.description
    ? site.description.slice(0, 2000)
    : null

  // Limit photo gallery to 1-10 images
  const photos = site.photo_gallery.slice(0, 10)

  // Limit timeline to 1-20 entries
  const timeline = site.timeline.slice(0, 20)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <header>
          <Link
            to="/app/map"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1 mb-4"
          >
            ← Back to Map
          </Link>
          <h1 className="text-3xl font-bold text-foreground">{site.name}</h1>
        </header>

        {/* Historical Write-up */}
        {(contentHtml || description) && (
          <section aria-labelledby="writeup-heading">
            <h2 id="writeup-heading" className="text-xl font-semibold mb-3">
              History
            </h2>
            {contentHtml ? (
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : (
              <p className="text-foreground leading-relaxed">{description}</p>
            )}
          </section>
        )}

        {/* Photo Gallery (1-10 images) */}
        {photos.length > 0 && (
          <section aria-labelledby="gallery-heading">
            <h2 id="gallery-heading" className="text-xl font-semibold mb-3">
              Photo Gallery
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((url, index) => (
                <div key={index} className="rounded-lg overflow-hidden bg-muted aspect-[4/3]">
                  {mediaErrors[`photo-${index}`] ? (
                    <div className="w-full h-full flex items-center justify-center p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Image temporarily unavailable
                      </p>
                    </div>
                  ) : (
                    <img
                      src={url}
                      alt={`${site.name} - Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={() => handleMediaError(`photo-${index}`)}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Audio Player - hidden if no content (Req 7.2) */}
        {site.audio_url && (
          <section aria-labelledby="audio-heading">
            <h2 id="audio-heading" className="text-xl font-semibold mb-3">
              Audio Narration
            </h2>
            {mediaErrors['audio'] ? (
              <p className="text-sm text-muted-foreground">
                Audio content is temporarily unavailable
              </p>
            ) : (
              <audio
                controls
                className="w-full"
                preload="metadata"
                onError={() => handleMediaError('audio')}
              >
                <source src={site.audio_url} />
                Your browser does not support the audio element.
              </audio>
            )}
          </section>
        )}

        {/* Video Embed - hidden if no content (Req 7.2) */}
        {site.video_url && (
          <section aria-labelledby="video-heading">
            <h2 id="video-heading" className="text-xl font-semibold mb-3">
              Video
            </h2>
            {mediaErrors['video'] ? (
              <p className="text-sm text-muted-foreground">
                Video content is temporarily unavailable
              </p>
            ) : (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <iframe
                  src={site.video_url}
                  title={`${site.name} video`}
                  className="w-full h-full"
                  allowFullScreen
                  loading="lazy"
                  onError={() => handleMediaError('video')}
                />
              </div>
            )}
          </section>
        )}

        {/* Historical Timeline (1-20 entries) */}
        {timeline.length > 0 && (
          <section aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="text-xl font-semibold mb-3">
              Timeline
            </h2>
            <ol className="relative border-l-2 border-primary/30 ml-4 space-y-4">
              {timeline.map((entry, index) => (
                <li key={index} className="pl-6 relative">
                  <span className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                  <time className="text-sm font-semibold text-primary">
                    {entry.year}
                  </time>
                  <p className="text-sm text-foreground mt-0.5">{entry.event}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}
