/**
 * Alphabetical sorting utility for partners.
 *
 * Sorts partners by name in ascending order using case-insensitive comparison.
 *
 * Validates: Requirements 13.1
 */

export interface Partner {
  id: string
  name: string
  description: string | null
  logo_url: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Sorts an array of partners alphabetically by name (case-insensitive).
 * Does not mutate the original array.
 */
export function sortPartnersAlphabetically(partners: Partner[]): Partner[] {
  return [...partners].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  )
}
