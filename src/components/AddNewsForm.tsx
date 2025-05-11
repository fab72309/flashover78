import { useState, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { addNewsPost } from '../services/firebaseService';

interface AddNewsFormProps {
  onSuccess?: () => void;
}

export default function AddNewsForm({ onSuccess }: AddNewsFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('L\'image ne doit pas dépasser 5MB');
        return;
      }
      
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setError('');
    } else {
      setError('Veuillez sélectionner une image valide');
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await addNewsPost(
        { title, content, imageUrl: '' },
        selectedImage
      );
      setTitle('');
      setContent('');
      setSelectedImage(null);
      setPreviewUrl('');
      onSuccess?.();
    } catch (error) {
      console.error('Error adding news:', error);
      setError('Erreur lors de l\'ajout de la news');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-white px-4 py-3 shadow-sm">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Titre</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50 text-base shadow-sm"
          required
        />
      </div>
      
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">Contenu</label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#FF4500] focus:ring focus:ring-[#FF4500] focus:ring-opacity-50 text-base shadow-sm"
          required
        />
      </div>
      
      <div>
        <input 
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageSelect}
        />
        
        {previewUrl ? (
          <div className="relative mt-2">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-10 p-2 bg-white rounded-full shadow-md hover:bg-gray-50"
            >
              <ImagePlus size={20} className="text-[#FF4500]" />
            </button>
            <button
              type="button"
              onClick={removeImage}
              className="absolute bottom-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-50"
            >
              <X size={20} className="text-red-500" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-[#FF4500] transition-colors"
          >
            <ImagePlus size={24} className="text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">Cliquez pour ajouter une image</span>
          </button>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#FF4500] text-white py-2.5 px-4 rounded-md hover:bg-[#FF4500]/90 disabled:opacity-50 text-base font-medium mt-4"
      >
        {loading ? 'Ajout en cours...' : 'Ajouter'}
      </button>
    </form>
  );
}