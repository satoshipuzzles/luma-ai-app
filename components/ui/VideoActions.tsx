import { useState } from 'react'
import { Copy, Download, Share } from 'lucide-react'

interface VideoActionsProps {
  videoUrl: string
  onShare: () => void
  onCopySuccess: () => void
}

export function VideoActions({ videoUrl, onShare, onCopySuccess }: VideoActionsProps) {
  const [downloading, setDownloading] = useState(false)

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(videoUrl)
      onCopySuccess()
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      // Generate filename from timestamp
      const timestamp = new Date().toISOString().split('T')[0]
      a.download = `animal-sunset-${timestamp}.mp4`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleCopyUrl}
        className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 min-w-[120px]"
      >
        <Copy className="w-4 h-4" />
        <span>Copy URL</span>
      </button>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 min-w-[120px]"
      >
        <Download className="w-4 h-4" />
        <span>{downloading ? 'Downloading...' : 'Download'}</span>
      </button>
      <button
        onClick={onShare}
        className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 min-w-[120px]"
      >
        <Share className="w-4 h-4" />
        <span>Share</span>
      </button>
    </div>
  )
}
