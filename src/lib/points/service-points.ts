/**
 * Service hour point calculation for ScoutChase Taguig.
 *
 * Rules:
 * - 10 points per verified hour
 * - Partial hours: floor(D) × 10, plus 5 if fractional part >= 0.5
 * - Monthly cap: 500 points per calendar month per user
 */

/** Maximum service points awardable per calendar month */
export const SERVICE_POINTS_MONTHLY_CAP = 500

/** Points awarded per full hour of service */
export const POINTS_PER_HOUR = 10

/** Points awarded for a half-hour (fractional >= 0.5) */
export const POINTS_PER_HALF_HOUR = 5

/**
 * Calculates service points for a given duration of verified service hours.
 *
 * Formula: floor(D) × 10 + (if fractional part >= 0.5 then 5 else 0)
 *
 * @param durationHours - Duration in hours (e.g., 3.5 means 3 hours and 30 minutes)
 * @returns Points earned for this service duration (before monthly cap is applied)
 */
export function calculateServicePoints(durationHours: number): number {
  if (durationHours <= 0) {
    return 0
  }

  const wholeHours = Math.floor(durationHours)
  const fractionalPart = durationHours - wholeHours

  let points = wholeHours * POINTS_PER_HOUR

  if (fractionalPart >= 0.5) {
    points += POINTS_PER_HALF_HOUR
  }

  return points
}

/**
 * Calculates the actual service points to award, respecting the monthly cap.
 *
 * If the user has already earned `totalPointsThisMonth` service points this month,
 * this function returns the amount that can still be awarded without exceeding the cap.
 *
 * @param totalPointsThisMonth - Total service points already earned this calendar month
 * @param newPoints - The new points to attempt to award
 * @param monthlyCap - The monthly cap (defaults to SERVICE_POINTS_MONTHLY_CAP = 500)
 * @returns The actual points to award (0 if cap already reached, reduced if partially remaining)
 */
export function calculateMonthlyServicePoints(
  totalPointsThisMonth: number,
  newPoints: number,
  monthlyCap: number = SERVICE_POINTS_MONTHLY_CAP
): number {
  if (totalPointsThisMonth >= monthlyCap) {
    return 0
  }

  const remaining = monthlyCap - totalPointsThisMonth
  return Math.min(newPoints, remaining)
}
