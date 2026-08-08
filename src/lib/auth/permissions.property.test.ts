import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { hasAccess, PERMISSIONS } from './permissions'
import type { UserRole } from '@/stores/auth'

/**
 * Property 3: RBAC access decision correctness
 *
 * For any pair of (user role, protected resource), the access control function
 * SHALL return `allow` if and only if the role appears in the resource's permission set,
 * and `deny` (403) otherwise.
 *
 * **Validates: Requirements 3.1, 3.9**
 */
describe('Property 3: RBAC access decision correctness', () => {
  // --- Constants ---
  const ALL_ROLES: UserRole[] = [
    'Guest',
    'Cub_Scout',
    'Boy_Scout',
    'Senior_Scout',
    'Rover_Scout',
    'Adult_Leader',
    'Council_Admin',
  ]

  const ALL_PROTECTED_RESOURCES = Object.keys(PERMISSIONS)

  // --- Generators ---

  /** Generate any of the 7 defined roles */
  const roleArb = fc.constantFrom(...ALL_ROLES)

  /** Generate any of the defined protected resource paths */
  const protectedResourceArb = fc.constantFrom(...ALL_PROTECTED_RESOURCES)

  /** Generate an unknown resource path (not in PERMISSIONS and not a sub-path of any entry) */
  const unknownResourceArb = fc.oneof(
    fc.constant('/'),
    fc.constant('/login'),
    fc.constant('/register'),
    fc.constant('/partners'),
    fc.constant('/join-scouting'),
    fc.constant('/unknown/page'),
    fc.constant('/public/something'),
    fc.constant('/xyz')
  ).filter((path) => !(path in PERMISSIONS))

  // --- Property Tests ---

  it('for any (role, protected resource) pair: hasAccess returns true iff role is in resource permission set', () => {
    fc.assert(
      fc.property(
        roleArb,
        protectedResourceArb,
        (role, resource) => {
          const allowedRoles = PERMISSIONS[resource]
          const expected = allowedRoles.includes(role)
          const actual = hasAccess(role, resource)
          expect(actual).toBe(expected)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('for any role and unknown resource (public route): hasAccess returns true (access allowed)', () => {
    fc.assert(
      fc.property(
        roleArb,
        unknownResourceArb,
        (role, resource) => {
          const actual = hasAccess(role, resource)
          expect(actual).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('access decision is deterministic: same (role, resource) always produces the same result', () => {
    fc.assert(
      fc.property(
        roleArb,
        protectedResourceArb,
        (role, resource) => {
          const result1 = hasAccess(role, resource)
          const result2 = hasAccess(role, resource)
          expect(result1).toBe(result2)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('Council_Admin has access to all protected resources', () => {
    fc.assert(
      fc.property(
        protectedResourceArb,
        (resource) => {
          expect(hasAccess('Council_Admin', resource)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('for sub-paths of protected resources: access follows the parent resource permissions', () => {
    /** Generate a sub-path by appending a segment to a protected resource */
    const subPathArb = fc.tuple(protectedResourceArb, fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
      { minLength: 1, maxLength: 10 }
    )).map(([resource, segment]) => ({
      parentResource: resource,
      subPath: `${resource}/${segment}`,
    }))

    fc.assert(
      fc.property(
        roleArb,
        subPathArb,
        (role, { parentResource, subPath }) => {
          // Sub-path should resolve to the parent's permissions via prefix matching
          const parentAllowed = PERMISSIONS[parentResource].includes(role)
          const actual = hasAccess(role, subPath)
          expect(actual).toBe(parentAllowed)
        }
      ),
      { numRuns: 300 }
    )
  })
})
