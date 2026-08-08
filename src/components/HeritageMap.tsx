import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

/** Marker data for a heritage site on the map */
export interface HeritageSiteMarker {
  id: string
  name: string
  lat: number
  lng: number
  trail_id: string
  trail_name: string
  is_unlocked: boolean
  is_active: boolean
}

export interface HeritageMapProps {
  sites: HeritageSiteMarker[]
  selectedTrailFilter?: string
  userUnlockedSiteIds: string[]
  onMarkerClick: (siteId: string) => void
}

// Default center: Taguig City
const TAGUIG_CENTER: L.LatLngExpression = [14.5176, 121.0509]
const DEFAULT_ZOOM = 13

/**
 * Create a circular SVG marker icon.
 * Green (#4CAF50) for unlocked sites, gray (#9E9E9E) for locked sites.
 * Validates: Requirements 5.4
 */
function createMarkerIcon(isUnlocked: boolean): L.DivIcon {
  const color = isUnlocked ? '#4CAF50' : '#9E9E9E'
  const borderColor = isUnlocked ? '#1B5E20' : '#616161'

  return L.divIcon({
    className: 'heritage-marker',
    html: `
      <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="12" fill="${color}" stroke="${borderColor}" stroke-width="2"/>
        <circle cx="14" cy="14" r="5" fill="white" opacity="0.8"/>
      </svg>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

/**
 * Interactive Heritage Map component with Leaflet.
 * Displays pin markers for all active heritage sites with unlock differentiation.
 *
 * Validates: Requirements 5.1, 5.2, 5.4
 */
export function HeritageMap({
  sites,
  userUnlockedSiteIds,
  onMarkerClick,
}: HeritageMapProps) {
  return (
    <MapContainer
      center={TAGUIG_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      scrollWheelZoom={true}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sites.map((site) => {
        const isUnlocked = userUnlockedSiteIds.includes(site.id)
        const icon = createMarkerIcon(isUnlocked)

        return (
          <Marker
            key={site.id}
            position={[site.lat, site.lng]}
            icon={icon}
            eventHandlers={{
              click: () => onMarkerClick(site.id),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[160px]">
                <h3 className="font-semibold text-sm text-gray-900 mb-1">
                  {site.name}
                </h3>
                <p className="text-xs text-gray-600 mb-1">
                  Trail: {site.trail_name}
                </p>
                <span
                  className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                    isUnlocked
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {isUnlocked ? '🔓 Unlocked' : '🔒 Locked'}
                </span>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}

export default HeritageMap
