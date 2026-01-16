import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Loader2 } from 'lucide-react';

interface ImageUploadButtonProps {
  onImageSelect: (base64: string) => void;
  onImageClear: () => void;
  selectedImage: string | null;
  disabled?: boolean;
  className?: string;
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Validate file size (max 4MB for OpenAI vision)
    if (file.size > 4 * 1024 * 1024) {
      return;
    }

    setLoading(true);

    try {
      const base64 = await fileToBase64(file);
      onImageSelect(base64);
    } catch (error) {
      console.error('Error converting image:', error);
    } finally {
      setLoading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || loading}
      />
      
      {selectedImage ? (
        <div className="relative inline-block">
          <img
            src={selectedImage}
            alt="Selected"
            className="w-12 h-12 rounded-lg object-cover border border-border"
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
