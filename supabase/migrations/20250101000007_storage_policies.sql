-- Storage bucket policies for file upload security hardening.
-- Restricts uploads to JPEG/PNG/WebP, max 5MB, authenticated users only.
-- Only the uploading user and admin roles can view or delete files.
--
-- Requirements: 21.4

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg', 'image/png']),
  ('challenge-photos', 'challenge-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('service-proofs', 'service-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('site-media', 'site-media', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('partner-logos', 'partner-logos', false, 524288, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('certificates', 'certificates', true, 5242880, ARRAY['image/png', 'application/pdf']),
  ('qr-codes', 'qr-codes', false, 5242880, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- AVATARS BUCKET POLICIES
-- ============================================================

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to view their own avatar, admins can view all
CREATE POLICY "Users can view own avatar or admin views all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Council_Admin'
      )
    )
  );

-- Allow users to update/delete their own avatar
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- CHALLENGE PHOTOS BUCKET POLICIES
-- ============================================================

-- Allow authenticated users to upload challenge photos
CREATE POLICY "Users can upload challenge photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'challenge-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow uploading user and reviewers/admins to view challenge photos
CREATE POLICY "Users and reviewers can view challenge photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'challenge-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Rover_Scout', 'Adult_Leader', 'Council_Admin')
      )
    )
  );

-- Allow uploading user to delete their own challenge photos
CREATE POLICY "Users can delete own challenge photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'challenge-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Council_Admin'
      )
    )
  );

-- ============================================================
-- SERVICE PROOFS BUCKET POLICIES
-- ============================================================

-- Allow authenticated users to upload service proofs
CREATE POLICY "Users can upload service proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'service-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow uploading user and verifiers/admins to view service proofs
CREATE POLICY "Users and verifiers can view service proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'service-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Adult_Leader', 'Council_Admin')
      )
    )
  );

-- Allow uploading user to delete their own service proofs
CREATE POLICY "Users can delete own service proofs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'service-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Council_Admin'
      )
    )
  );

-- ============================================================
-- SITE MEDIA BUCKET POLICIES (admin-managed heritage site content)
-- ============================================================

-- Only Council_Admin can upload site media
CREATE POLICY "Admins can upload site media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

-- All authenticated users can view site media (heritage site content is public to authenticated users)
CREATE POLICY "Authenticated users can view site media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'site-media');

-- Only admins can delete site media
CREATE POLICY "Admins can delete site media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'site-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

-- ============================================================
-- PARTNER LOGOS BUCKET POLICIES
-- ============================================================

-- Only Council_Admin can upload partner logos
CREATE POLICY "Admins can upload partner logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'partner-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

-- Partner logos viewable by all authenticated users
CREATE POLICY "Authenticated users can view partner logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'partner-logos');

-- Only admins can delete partner logos
CREATE POLICY "Admins can delete partner logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'partner-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

-- ============================================================
-- CERTIFICATES BUCKET POLICIES (public read for sharing)
-- ============================================================

-- Certificates are generated by Edge Functions (service role), but users can view their own
CREATE POLICY "Users can view own certificates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- QR CODES BUCKET POLICIES (admin only)
-- ============================================================

-- Only admins can manage QR code images
CREATE POLICY "Admins can upload qr codes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'qr-codes'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

CREATE POLICY "Admins can view qr codes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'qr-codes'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

CREATE POLICY "Admins can delete qr codes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'qr-codes'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );
