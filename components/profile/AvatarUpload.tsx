'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type AvatarUploadProps = {
  userId: string
  currentAvatarUrl?: string | null
  initials: string
  onAvatarUpdate: (url: string) => void
}

export function AvatarUpload({ userId, currentAvatarUrl, initials, onAvatarUpdate }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please select a JPG, PNG, or WebP image')
      return
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024 // 2MB in bytes
    if (file.size > maxSize) {
      setError('Image must be smaller than 2MB')
      return
    }

    setUploading(true)

    try {
      // Create a square crop using canvas
      const croppedBlob = await cropImageToSquare(file)

      // Upload to Supabase Storage
      const fileName = `${userId}/avatar.jpg`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, {
          cacheControl: '3600',
          upsert: true, // Replace existing file
          contentType: 'image/jpeg'
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Save URL to user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      })

      if (updateError) {
        throw updateError
      }

      // Notify parent component
      onAvatarUpdate(publicUrl)

    } catch (err) {
      console.error('Error uploading avatar:', err)
      setError('Failed to upload avatar. Please try again.')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const cropImageToSquare = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // Create canvas with square dimensions
          const size = Math.min(img.width, img.height)
          const canvas = document.createElement('canvas')
          canvas.width = 400
          canvas.height = 400
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }

          // Calculate crop position (center crop)
          const sourceX = (img.width - size) / 2
          const sourceY = (img.height - size) / 2

          // Draw cropped and resized image
          ctx.drawImage(
            img,
            sourceX, sourceY, size, size, // Source rectangle
            0, 0, 400, 400 // Destination rectangle
          )

          // Convert canvas to blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Could not create blob from canvas'))
              }
            },
            'image/jpeg',
            0.9 // Quality
          )
        }
        img.onerror = () => reject(new Error('Could not load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Could not read file'))
      reader.readAsDataURL(file)
    })
  }

  return (
    <div className="relative group">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="relative w-20 h-20 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Avatar or Initials */}
        {currentAvatarUrl ? (
          <img
            src={currentAvatarUrl}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[#3D7A5F] dark:bg-[#4E9A78] flex items-center justify-center text-white text-2xl font-semibold">
            {initials}
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs">
          {uploading ? (
            <div className="flex flex-col items-center gap-1">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              <span>Uploading...</span>
            </div>
          ) : (
            <>
              <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Change photo</span>
            </>
          )}
        </div>
      </button>

      {/* Error Message */}
      {error && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs px-3 py-2 rounded-lg whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  )
}
