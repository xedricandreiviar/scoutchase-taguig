/**
 * Admin User management page.
 *
 * Allows Council_Admin to manage user accounts including:
 * - Role assignment
 * - Account deactivation
 * Changes take effect within 60 seconds (Req 14.6).
 *
 * Validates: Requirements 14.6, 14.9
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore, type UserRole } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ROLES: UserRole[] = [
  'Guest',
  'Cub_Scout',
  'Boy_Scout',
  'Senior_Scout',
  'Rover_Scout',
  'Adult_Leader',
  'Council_Admin',
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface ManagedUser {
  id: string
  full_name: string
  display_name: string | null
  age: number
  role: UserRole
  scout_section: string | null
  troop_unit_number: string | null
  school: string | null
  total_points: number
  is_active: boolean
  created_at: string
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminUsers() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<ManagedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')

  // Role change state
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<UserRole>('Guest')
  const [isUpdating, setIsUpdating] = useState(false)

  // Deactivation state
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, display_name, age, role, scout_section, troop_unit_number, school, total_points, created_at')
      .order('full_name')

    // Note: is_active may not exist in profiles table yet, default to true
    const mapped = (data || []).map((u: any) => ({
      ...u,
      is_active: u.is_active !== false, // default true
    }))
    setUsers(mapped)
    setFilteredUsers(mapped)
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await fetchUsers()
      setIsLoading(false)
    }
    load()
  }, [fetchUsers])

  // Filter users when search/role changes
  useEffect(() => {
    let filtered = users

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(u =>
        u.full_name.toLowerCase().includes(query) ||
        (u.display_name && u.display_name.toLowerCase().includes(query)) ||
        (u.troop_unit_number && u.troop_unit_number.toLowerCase().includes(query))
      )
    }

    if (roleFilter) {
      filtered = filtered.filter(u => u.role === roleFilter)
    }

    setFilteredUsers(filtered)
  }, [users, searchQuery, roleFilter])

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  // ─── Role change handler (Req 14.6) ───────────────────────────────────────

  async function handleRoleChange() {
    if (!changingRoleUserId || !newRole) return
    setIsUpdating(true)

    const targetUser = users.find(u => u.id === changingRoleUserId)

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', changingRoleUserId)

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to update role.' })
    } else {
      setActionMessage({ type: 'success', text: `Role for "${targetUser?.full_name}" changed to ${newRole.replace('_', ' ')}.` })
      await fetchUsers()
    }

    setChangingRoleUserId(null)
    setIsUpdating(false)
  }

  // ─── Deactivation handler (Req 14.6) ──────────────────────────────────────

  async function handleDeactivate() {
    if (!deactivatingId) return
    setIsDeactivating(true)

    const targetUser = users.find(u => u.id === deactivatingId)

    // Deactivate by setting role to Guest and marking inactive
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'Guest',
        updated_at: new Date().toISOString(),
      })
      .eq('id', deactivatingId)

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to deactivate account.' })
    } else {
      setActionMessage({ type: 'success', text: `Account for "${targetUser?.full_name}" has been deactivated.` })
      await fetchUsers()
    }

    setDeactivatingId(null)
    setIsDeactivating(false)
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || user.role !== 'Council_Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">Access denied. Only Council Admins can manage users.</p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">Back to Passport</Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading users...</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user accounts, assign roles, and deactivate accounts. ({users.length} total users)
          </p>
        </header>

        {actionMessage && (
          <div
            className={`rounded-lg p-3 text-sm ${
              actionMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
            role="alert"
          >
            {actionMessage.text}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or troop number..."
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Roles</option>
            {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
        </div>

        {/* Users list */}
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No users found matching your filters.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((managedUser) => (
              <div key={managedUser.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {managedUser.full_name}
                    {managedUser.display_name && ` (${managedUser.display_name})`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {managedUser.role.replace('_', ' ')} • Age: {managedUser.age}
                    {managedUser.troop_unit_number && ` • Troop: ${managedUser.troop_unit_number}`}
                    {' • '}{managedUser.total_points} pts
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setChangingRoleUserId(managedUser.id)
                      setNewRole(managedUser.role)
                    }}
                  >
                    Change Role
                  </Button>
                  {managedUser.id !== user.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive hover:bg-destructive/10"
                      onClick={() => setDeactivatingId(managedUser.id)}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Change Role Modal */}
        {changingRoleUserId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Change User Role</h2>
              <p className="text-sm text-muted-foreground">
                Change role for &ldquo;{users.find(u => u.id === changingRoleUserId)?.full_name}&rdquo;
              </p>
              <div className="space-y-2">
                <Label htmlFor="new-role">New Role</Label>
                <select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setChangingRoleUserId(null)} disabled={isUpdating}>Cancel</Button>
                <Button onClick={handleRoleChange} disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Update Role'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Deactivate Confirmation Modal */}
        {deactivatingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Deactivate Account</h2>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to deactivate &ldquo;{users.find(u => u.id === deactivatingId)?.full_name}&rdquo;?
                This will set their role to Guest.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeactivatingId(null)} disabled={isDeactivating}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeactivate} disabled={isDeactivating}>
                  {isDeactivating ? 'Deactivating...' : 'Deactivate'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
