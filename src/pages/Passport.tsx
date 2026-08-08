import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { validateDisplayName } from '@/lib/validators/display-name'
import { validateFileUpload, getImageDimensions } from '@/lib/validators/file-upload'
import { formatServiceHours } from '@/lib/passport/format-service-hours'

export default function Passport() {
  const { user, setUser } = useAuthStore()
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [displayNameError, setDisplayNameError] = useState<string | undefined>()
  const [avatarError, setAvatarError] = useState<string | undefined>()
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url ?? null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name ?? '')
      setAvatarPreview(user.avatar_url ?? null)
    }
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading passport...</p>
      </div>
    )
  }

  function handleDisplayNameChange(value: string) {
    setDisplayName(value)
    setSaveSuccess(false)
    if (value.length === 0) {
      setDisplayNameError(undefined)
      return
    }
    const result = validateDisplayName(value)
    setDisplayNameError(result.error)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarError(undefined)
    setSaveSuccess(false)

    // Basic file validation (type + size)
    const basicResult = validateFileUpload(file, 'avatar')
    if (!basicResult.valid) {
      setAvatarError(basicResult.error)
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Check dimensions
    try {
      const dims = await getImageDimensions(file)
      const dimResult = validateFileUpload(
        { type: file.type, size: file.size, width: dims.width, height: dims.height },
        'avatar'
      )
      if (!dimResult.valid) {
        setAvatarError(dimResult.error)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
    } catch {
      setAvatarError('Failed to read image dimensions')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Show preview
    setSelectedFile(file)
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
  }

  async function handleSaveProfile() {
    if (!user) return

    // Validate display name if provided
    if (displayName.length > 0) {
      const nameResult = validateDisplayName(displayName)
      if (!nameResult.valid) {
        setDisplayNameError(nameResult.error)
        return
      }
    }

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      let avatarUrl = user.avatar_url

      // Upload avatar if a new file was selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const filePath = `${user.id}/avatar.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, selectedFile, { upsert: true })

        if (uploadError) {
          setAvatarError(`Upload failed: ${uploadError.message}`)
          setIsSaving(false)
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        avatarUrl = publicUrlData.publicUrl
      }

      // Update profile
      const updates: { display_name?: string | null; avatar_url?: string | null } = {}

      if (displayName.length > 0) {
        updates.display_name = displayName
      } else {
        updates.display_name = null
      }

      if (avatarUrl !== user.avatar_url) {
        updates.avatar_url = avatarUrl
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (updateError) {
        setDisplayNameError(`Save failed: ${updateError.message}`)
        setIsSaving(false)
        return
      }

      // Update local state
      setUser({
        ...user,
        display_name: updates.display_name !== undefined ? updates.display_name : user.display_name,
        avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url,
      })

      setSelectedFile(null)
      setSaveSuccess(true)
      setIsEditingProfile(false)
    } catch (err) {
      setDisplayNameError('An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancelEdit() {
    setDisplayName(user?.display_name ?? '')
    setAvatarPreview(user?.avatar_url ?? null)
    setSelectedFile(null)
    setDisplayNameError(undefined)
    setAvatarError(undefined)
    setIsEditingProfile(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <h1 className="text-3xl font-bold text-primary">Digital Passport</h1>

        {/* Profile Section */}
        <div className="bg-card rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Profile</h2>
            {!isEditingProfile && (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="text-sm text-primary hover:underline"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={`${user.display_name || user.full_name}'s avatar`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl text-muted-foreground">
                  {(user.display_name || user.full_name).charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {isEditingProfile && (
              <div className="space-y-1">
                <label
                  htmlFor="avatar-upload"
                  className="inline-block px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded cursor-pointer hover:bg-primary/90"
                >
                  Upload Avatar
                </label>
                <input
                  ref={fileInputRef}
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleAvatarChange}
                  className="sr-only"
                  aria-describedby={avatarError ? 'avatar-error' : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  JPEG or PNG, max 2MB, max 512×512px
                </p>
                {avatarError && (
                  <p id="avatar-error" className="text-xs text-destructive" role="alert">
                    {avatarError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Display Name */}
          {isEditingProfile ? (
            <div className="space-y-1">
              <label htmlFor="display-name" className="text-sm font-medium">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder="Enter a display name (3-30 characters)"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                aria-describedby={displayNameError ? 'display-name-error' : undefined}
                aria-invalid={!!displayNameError}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, spaces, and hyphens only
              </p>
              {displayNameError && (
                <p id="display-name-error" className="text-xs text-destructive" role="alert">
                  {displayNameError}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">Display Name</p>
              <p className="font-medium">{user.display_name || user.full_name}</p>
            </div>
          )}

          {/* Full Name (read-only) */}
          <div>
            <p className="text-sm text-muted-foreground">Full Name</p>
            <p className="font-medium">{user.full_name}</p>
          </div>

          {/* Role */}
          <div>
            <p className="text-sm text-muted-foreground">Role</p>
            <p className="font-medium">{user.role.replace(/_/g, ' ')}</p>
          </div>

          {/* Edit Actions */}
          {isEditingProfile && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving || !!displayNameError}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-4 py-2 border text-sm rounded-md hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}

          {saveSuccess && (
            <p className="text-sm text-green-600" role="status">
              Profile updated successfully
            </p>
          )}
        </div>

        {/* Stats Section (Placeholder - will be populated in task 1.11) */}
        <div className="bg-card rounded-lg border p-6 space-y-4">
          <h2 className="text-xl font-semibold">Progress</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted rounded-md">
              <p className="text-2xl font-bold">{user.total_points}</p>
              <p className="text-xs text-muted-foreground">Points</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-md">
              <p className="text-2xl font-bold">{formatServiceHours(user.total_service_hours)}</p>
              <p className="text-xs text-muted-foreground">Service Hours</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-md">
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">Sites Visited</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-md">
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">Challenges</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-md">
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">Badges</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-md">
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-muted-foreground">Rank</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
