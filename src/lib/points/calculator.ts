/**
 * Points calculator for ScoutChase Taguig.
 *
 * Total point formula:
 *   challenges × 50 + servicePoints + trails × 100 + events × 25
 *
 * Note: servicePoints should already be the capped value (use calculateMonthlyServicePoints
 * from service-points.ts to compute the capped service points before passing here).
 */

export interface ActivityCounts {
  /** Number of completed challenges */
  challenges: number
  /** Service points already computed and capped */
  servicePoints: number
  /** Number of completed trails */
  trails: number
  /** Number of events attended */
  events: number
}

export const POINTS_PER_CHALLENGE = 50
export const POINTS_PER_TRAIL = 100
export const POINTS_PER_EVENT = 25

/**
 * Calculates total points from all activity types.
 *
 * @param activities - The activity counts (challenges, servicePoints, trails, events)
 * @returns The total points as an integer
 */
export function calculateTotalPoints(activities: ActivityCounts): number {
  const { challenges, servicePoints, trails, events } = activities

  return (
    challenges * POINTS_PER_CHALLENGE +
    servicePoints +
    trails * POINTS_PER_TRAIL +
    events * POINTS_PER_EVENT
  )
}
