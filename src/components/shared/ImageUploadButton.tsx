import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadButtonProps {
  onImageSelect: (dataUrl: string) => void;
  onImageClear: () => void;
  selectedImage: string | null;
  disabled?: boolean;
  className?: string;
}

const MAX_BYTES = 4 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

function isSupportedMimeType(mime: string): mime is (typeof SUPPORTED_MIME_TYPES)[number] {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime);
}

export default function ImageUploadButton({
  onImageSelect,
  onImageClear,
  selectedImage,
  disabled = false,
  className = '',
}: ImageUploadButtonProps) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Validate file type (OpenAI vision: JPG/PNG/WEBP/GIF)
    if (!isSupportedMimeType(file.type)) {
      toast.error('Unsupported image type. Please upload JPG, PNG, or WEBP.');
      return;
    }

    // Validate file size
    if (file.size > MAX_BYTES) {
      toast.error('Image too large. Please upload an image under 4MB.');
      return;
    }

    setLoading(true);

    try {
      const dataUrl = await fileToDataUrl(file);
      onImageSelect(dataUrl);
    } catch (error) {
      console.error('Error converting image:', error);
      toast.error('Failed to read image. Please try a different file.');
    } finally {
      setLoading(false);
    }
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  return (
    <div className={`relative ${className}`.trim()}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || loading}
      />

      {selectedImage ? (
        <div className="relative inline-block">
          <img
            src={selectedImage}
            alt="Selected upload"
            className="w-12 h-12 rounded-lg object-cover border border-border"
            loading="lazy"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onImageClear();
            }}
            disabled={disabled}
            aria-label="Remove image"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || loading}
          className="h-10 w-10"
          aria-label="Upload image"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
        </Button>
      )}
    </div>
  );
}
