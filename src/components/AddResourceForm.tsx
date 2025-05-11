import { useState } from 'react';
import { addResource } from '../services/firebaseService';
import type { Resource } from '../types';

export default function AddResourceForm() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Resource['category']>('SDIS78');
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await addResource({
        title,
        category,
        fileUrl
      });
      setTitle('');
      setCategory('SDIS78');
      setFileUrl('');
      alert('Resource added successfully!');
    } catch (error) {
      console.error('Error adding resource:', error);
      alert('Error adding resource');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
          required
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Resource['category'])}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
          required
        >
          <option value="SDIS78">SDIS78</option>
          <option value="GDO_GTO">GDO/GTO</option>
          <option value="LECTURES">Lectures diverses</option>
        </select>
      </div>
      
      <div>
        <label htmlFor="fileUrl" className="block text-sm font-medium text-gray-700">File URL</label>
        <input
          type="url"
          id="fileUrl"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add Resource'}
      </button>
    </form>
  );
}