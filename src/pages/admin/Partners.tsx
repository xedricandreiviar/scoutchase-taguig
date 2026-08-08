/**
 * Admin Partners management page.
 *
 * Allows Council_Admin to add, edit, and remove partner organizations
 * with validation: name required, logo required (max 500KB),
 * description max 200 characters.
 *
 * Changes are reflected on public Partners page within 60 seconds (via Realtime).
 *
 * Validates: Requirements 13.2, 13.3
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { sortPartnersAlphabetically, type Partner } from '@/lib/partners/sort'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_LOGO_SIZE_BYTES = 500 * 1024 // 500 KB
const MAX_DESCRIPTION_LENGTH = 200
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

// ─── Validation ──────────────────────────────────────────────────────────────

interface PartnerFormErrors {
  name?: string
  logo?: string
  description?: string
}

function validatePartnerForm(
  name: string,
  logoFile: File | null,
  description: string,
  isEdit: boolean,
  existingLogoUrl?: string
): PartnerFormErrors {
  const errors: PartnerFormErrors = {}

  if (!name.trim()) {
    errors.name = 'Partner name is required.'
  }

  if (!isEdit && !logoFile) {
    errors.logo = 'Logo is required.'
  }

  if (isEdit && !logoFile && !existingLogoUrl) {
    errors.logo = 'Logo is required.'
  }

  if (logoFile) {
    if (!ALLOWED_LOGO_TYPES.includes(logoFile.type)) {
      errors.logo = 'Logo must be JPEG, PNG, WebP, or SVG format.'
    } else if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
      errors.logo = `Logo must be 500 KB or smaller (current: ${(logoFile.size / 1024).toFixed(0)} KB).`
    }
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer (current: ${description.length}).`
  }

  return errors
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminPartners() {
  const { user } = useAuthStore()
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formLogoFile, setFormLogoFile] = useState<File | null>(null)
  const [formErrors, setFormErrors] = useState<PartnerFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Fetch partners ────────────────────────────────────────────────────────

  const fetchPartners = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('partners')
      .select('*')

    if (fetchError) {
      setError('Failed to load partners.')
      return
    }

    setPartners(sortPartnersAlphabetically(data || []))
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await fetchPartners()
      setIsLoading(false)
    }
    load()
  }, [fetchPartners])

  // ─── Form handlers ─────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingPartner(null)
    setFormName('')
    setFormDescription('')
    setFormLogoFile(null)
    setFormErrors({})
    setShowForm(true)
  }

  function openEditForm(partner: Partner) {
    setEditingPartner(partner)
    setFormName(partner.name)
    setFormDescription(partner.description || '')
    setFormLogoFile(null)
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingPartner(null)
    setFormName('')
    setFormDescription('')
    setFormLogoFile(null)
    setFormErrors({})
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    setFormLogoFile(file)
    // Clear logo error on new selection
    if (formErrors.logo) {
      setFormErrors((prev) => ({ ...prev, logo: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormErrors({})
    setActionMessage(null)

    const isEdit = !!editingPartner
    const errors = validatePartnerForm(
      formName,
      formLogoFile,
      formDescription,
      isEdit,
      editingPartner?.logo_url
    )

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSubmitting(true)

    try {
      let logoUrl = editingPartner?.logo_url || ''

      // Upload logo if provided
      if (formLogoFile) {
        const fileExt = formLogoFile.name.split('.').pop()
        const fileName = `partner-${Date.now()}.${fileExt}`
        const filePath = `partners/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('public-assets')
          .upload(filePath, formLogoFile, {
            contentType: formLogoFile.type,
            upsert: false,
          })

        if (uploadError) {
          setFormErrors({ logo: 'Failed to upload logo. Please try again.' })
          setIsSubmitting(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath)

        logoUrl = urlData.publicUrl
      }

      if (isEdit && editingPartner) {
        // Update existing partner
        const { error: updateError } = await supabase
          .from('partners')
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            logo_url: logoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPartner.id)

        if (updateError) {
          setActionMessage({ type: 'error', text: 'Failed to update partner.' })
          setIsSubmitting(false)
          return
        }

        setActionMessage({ type: 'success', text: `Partner "${formName.trim()}" updated successfully.` })
      } else {
        // Create new partner
        const { error: insertError } = await supabase
          .from('partners')
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
            logo_url: logoUrl,
            is_active: true,
          })

        if (insertError) {
          setActionMessage({ type: 'error', text: 'Failed to add partner.' })
          setIsSubmitting(false)
          return
        }

        setActionMessage({ type: 'success', text: `Partner "${formName.trim()}" added successfully.` })
      }

      closeForm()
      await fetchPartners()
    } catch {
      setActionMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Delete handler ────────────────────────────────────────────────────────

  async function handleDelete(partnerId: string) {
    setIsDeleting(true)
    setActionMessage(null)

    const partner = partners.find((p) => p.id === partnerId)

    const { error: deleteError } = await supabase
      .from('partners')
      .delete()
      .eq('id', partnerId)

    if (deleteError) {
      setActionMessage({ type: 'error', text: 'Failed to remove partner.' })
      setIsDeleting(false)
      setDeletingId(null)
      return
    }

    setActionMessage({ type: 'success', text: `Partner "${partner?.name}" removed successfully.` })
    setDeletingId(null)
    setIsDeleting(false)
    await fetchPartners()
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || user.role !== 'Council_Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">
            Access denied. Only Council Admins can manage partners.
          </p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">
            Back to Passport
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading partners...</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manage Partners</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add, edit, or remove partner organizations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/partners"
              className="text-sm text-primary hover:underline"
            >
              View Public Page
            </Link>
            <Button onClick={openAddForm}>Add Partner</Button>
          </div>
        </header>

        {/* Action message */}
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

        {error && (
          <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Partners list */}
        {partners.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No partners yet. Add your first partner organization.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="rounded-lg border border-border bg-card p-4 flex items-center gap-4"
              >
                <div className="h-[60px] w-[80px] flex items-center justify-center flex-shrink-0">
                  <img
                    src={partner.logo_url}
                    alt={`${partner.name} logo`}
                    className="max-h-[60px] max-w-[80px] object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{partner.name}</h3>
                  {partner.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {partner.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {partner.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditForm(partner)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingId(partner.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-form-title"
          >
            <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h2 id="partner-form-title" className="text-lg font-semibold text-foreground">
                {editingPartner ? 'Edit Partner' : 'Add New Partner'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="partner-name">
                    Organization Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="partner-name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Enter organization name"
                    aria-invalid={!!formErrors.name}
                    aria-describedby={formErrors.name ? 'partner-name-error' : undefined}
                  />
                  {formErrors.name && (
                    <p id="partner-name-error" className="text-sm text-destructive">
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label htmlFor="partner-logo">
                    Logo <span className="text-destructive">*</span>
                  </Label>
                  {editingPartner?.logo_url && !formLogoFile && (
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src={editingPartner.logo_url}
                        alt="Current logo"
                        className="h-10 w-auto object-contain"
                      />
                      <span className="text-xs text-muted-foreground">Current logo</span>
                    </div>
                  )}
                  <Input
                    id="partner-logo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    onChange={handleLogoChange}
                    aria-invalid={!!formErrors.logo}
                    aria-describedby="partner-logo-help partner-logo-error"
                  />
                  <p id="partner-logo-help" className="text-xs text-muted-foreground">
                    JPEG, PNG, WebP, or SVG. Maximum 500 KB.
                  </p>
                  {formErrors.logo && (
                    <p id="partner-logo-error" className="text-sm text-destructive">
                      {formErrors.logo}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="partner-description">Description</Label>
                  <textarea
                    id="partner-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    maxLength={MAX_DESCRIPTION_LENGTH + 50}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y text-sm"
                    placeholder="Brief description of the organization (max 200 characters)"
                    aria-invalid={!!formErrors.description}
                    aria-describedby="partner-desc-count partner-desc-error"
                  />
                  <p
                    id="partner-desc-count"
                    className={`text-xs text-right ${
                      formDescription.length > MAX_DESCRIPTION_LENGTH
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {formDescription.length}/{MAX_DESCRIPTION_LENGTH}
                  </p>
                  {formErrors.description && (
                    <p id="partner-desc-error" className="text-sm text-destructive">
                      {formErrors.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeForm}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving...'
                      : editingPartner
                        ? 'Update Partner'
                        : 'Add Partner'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingId && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <div className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
              <h2 id="delete-confirm-title" className="text-lg font-semibold text-foreground">
                Remove Partner
              </h2>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to remove &ldquo;{partners.find((p) => p.id === deletingId)?.name}&rdquo;?
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeletingId(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(deletingId)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
