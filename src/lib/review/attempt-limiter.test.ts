import { describe, it, expect } from 'vitest'
import {
  canResubmit,
  getSubmissionStatus,
  getServiceLogStatus,
  isValidFeedback,
} from './attempt-limiter'

describe('attempt-limiter', () => {
  describe('canResubmit', () => {
    it('returns true when attempt < max', () => {
      expect(canResubmit(1, 3)).toBe(true)
      expect(canResubmit(2, 3)).toBe(true)
    })

    it('returns false when attempt >= max', () => {
      expect(canResubmit(3, 3)).toBe(false)
      expect(canResubmit(4, 3)).toBe(false)
    })

    it('returns false when attempt equals max of 1', () => {
      expect(canResubmit(1, 1)).toBe(false)
    })
  })

  describe('getSubmissionStatus', () => {
    it('returns approved for approve action regardless of attempts', () => {
      expect(getSubmissionStatus(1, 3, 'approve')).toBe('approved')
      expect(getSubmissionStatus(3, 3, 'approve')).toBe('approved')
    })

    it('returns rejected when reject and attempt < max', () => {
      expect(getSubmissionStatus(1, 3, 'reject')).toBe('rejected')
      expect(getSubmissionStatus(2, 3, 'reject')).toBe('rejected')
    })

    it('returns failed when reject and attempt >= max', () => {
      expect(getSubmissionStatus(3, 3, 'reject')).toBe('failed')
      expect(getSubmissionStatus(4, 3, 'reject')).toBe('failed')
    })
  })

  describe('getServiceLogStatus', () => {
    it('returns verified for approve action', () => {
      expect(getServiceLogStatus(1, 3, 'approve')).toBe('verified')
      expect(getServiceLogStatus(3, 3, 'approve')).toBe('verified')
    })

    it('returns rejected for reject action', () => {
      expect(getServiceLogStatus(1, 3, 'reject')).toBe('rejected')
      expect(getServiceLogStatus(3, 3, 'reject')).toBe('rejected')
    })
  })

  describe('isValidFeedback', () => {
    it('returns true for feedback >= 10 characters', () => {
      expect(isValidFeedback('This is enough feedback')).toBe(true)
      expect(isValidFeedback('1234567890')).toBe(true)
    })

    it('returns false for feedback < 10 characters', () => {
      expect(isValidFeedback('short')).toBe(false)
      expect(isValidFeedback('123456789')).toBe(false)
      expect(isValidFeedback('')).toBe(false)
    })

    it('trims whitespace before checking length', () => {
      expect(isValidFeedback('         ')).toBe(false)
      expect(isValidFeedback('   short  ')).toBe(false)
      expect(isValidFeedback('  ten chars!  ')).toBe(true)
    })
  })
})
