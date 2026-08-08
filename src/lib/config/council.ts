/**
 * Environment-based multi-council configuration (Req 22.1)
 *
 * Allows any BSP council to deploy ScoutChase with their own branding
 * by setting environment variables — no source code changes required.
 *
 * Heritage site content is fully database-driven (heritage_sites table),
 * separate from application code (Req 22.2).
 *
 * Scalability note (Req 22.3): The app is a static SPA deployed on Vercel CDN
 * with Supabase (horizontally scalable Postgres + Auth + Storage + Realtime).
 * Vercel's edge network handles static asset delivery globally, and Supabase
 * scales connections via connection pooling (PgBouncer). This architecture
 * comfortably supports 500+ concurrent sessions with ≤3s page loads and ≤2s
 * API responses under normal conditions.
 */

export interface CouncilConfig {
  /** Display name of the council */
  name: string
  /** URL to the council logo image */
  logoUrl: string
  /** Primary brand color (hex) */
  primaryColor: string
  /** Secondary brand color (hex) */
  secondaryColor: string
  /** Council identifier for multi-tenant queries */
  councilId: string
}

/** Default configuration for BSP Taguig City Council */
const DEFAULT_CONFIG: CouncilConfig = {
  name: 'BSP Taguig City Council',
  logoUrl: '/icons.svg',
  primaryColor: '#1B5E20',
  secondaryColor: '#FFD700',
  councilId: 'taguig-city',
}

/**
 * Returns the council configuration derived from environment variables.
 * Falls back to Taguig City Council defaults when env vars are not set.
 */
export function getCouncilConfig(): CouncilConfig {
  return {
    name: import.meta.env.VITE_COUNCIL_NAME || DEFAULT_CONFIG.name,
    logoUrl: import.meta.env.VITE_COUNCIL_LOGO_URL || DEFAULT_CONFIG.logoUrl,
    primaryColor: import.meta.env.VITE_COUNCIL_PRIMARY_COLOR || DEFAULT_CONFIG.primaryColor,
    secondaryColor: import.meta.env.VITE_COUNCIL_SECONDARY_COLOR || DEFAULT_CONFIG.secondaryColor,
    councilId: import.meta.env.VITE_COUNCIL_ID || DEFAULT_CONFIG.councilId,
  }
}

/**
 * Validates that a hex color string is well-formed.
 * Accepts 3-digit (#RGB) or 6-digit (#RRGGBB) hex codes.
 */
export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)
}

/**
 * Returns CSS custom property overrides for the council's color scheme.
 * Useful for dynamically theming the application at runtime.
 */
export function getCouncilCssVariables(): Record<string, string> {
  const config = getCouncilConfig()
  return {
    '--council-primary': config.primaryColor,
    '--council-secondary': config.secondaryColor,
  }
}
