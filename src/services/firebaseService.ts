import { collection, addDoc, doc, serverTimestamp, Timestamp, arrayUnion, updateDoc } from 'firebase/firestore';
import { db, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { COLLECTIONS } from '../utils/constants';
import type { NewsPost, CalendarEvent, Resource } from '../types';

// SDIS78 Documents Services
export const getSdis78Files = async () => {
  try {
    const storageRef = ref(storage, 'Documents_sdis78');
    const result = await listAll(storageRef);
    
    const files = await Promise.all(
      result.items.map(async (item) => {
        const url = await getDownloadURL(item);
        return {
          name: item.name,
          url,
          path: item.fullPath,
        };
      })
    );
    
    return files;
  } catch (error) {
    console.error('Error getting SDIS78 files:', error);
    throw error;
  }
};

// Brulage Services
export const getBrulageFoFiles = async () => {
  try {
    const storageRef = ref(storage, 'Brulage_FO');
    const result = await listAll(storageRef);
    
    const files = await Promise.all(
      result.items.map(async (item) => {
        const url = await getDownloadURL(item);
        return {
          name: item.name,
          url,
          path: item.fullPath,
        };
      })
    );
    
    return files;
  } catch (error) {
    console.error('Error getting brulage files:', error);
    throw error;
  }
};

// Lectures Documents Services
export const getLecturesFiles = async () => {
  try {
    const storageRef = ref(storage, 'Lectures_diverses');
    const result = await listAll(storageRef);
    
    const files = await Promise.all(
      result.items.map(async (item) => {
        const url = await getDownloadURL(item);
        return {
          name: item.name,
          url,
          path: item.fullPath,
        };
      })
    );
    
    return files;
  } catch (error) {
    console.error('Error getting lectures files:', error);
    throw error;
  }
};

// Helper function to generate a unique filename
const generateUniqueFileName = (file: File) => {
  const extension = file.name.split('.').pop();
  return `${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`;
};

// News Services
export const addNewsPost = async (post: Omit<NewsPost, 'id' | 'createdAt'>, imageFile?: File) => {
  try {
    let imageUrl = '';
    let imagePath = '';

    // Upload image if provided
    if (imageFile) {
      const uniqueFileName = generateUniqueFileName(imageFile);
      imagePath = `news-images/${uniqueFileName}`;
      const storageRef = ref(storage, imagePath);
      const snapshot = await uploadBytes(storageRef, imageFile);
      imageUrl = await getDownloadURL(snapshot.ref);
    }

    // Create the document with the exact field names matching your Firestore structure
    const docRef = await addDoc(collection(db, COLLECTIONS.NEWS), {
      title: post.title || '',
      content: post.content || '',
      imageUrl,
      imagePath,
      readBy: [],
      createdAt: serverTimestamp()
    });

    console.log('News post added successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding news post:', error);
    throw error;
  }
};

// Mark news as read
export const markNewsAsRead = async (newsId: string, userId: string) => {
  try {
    const newsRef = doc(db, COLLECTIONS.NEWS, newsId);
    await updateDoc(newsRef, {
      readBy: arrayUnion(userId)
    });
  } catch (error) {
    console.error('Error marking news as read:', error);
    throw error;
  }
};

// Delete image from storage
export const deleteImage = async (imagePath: string) => {
  if (!imagePath) return;
  try {
    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};
// Calendar Services
export const addEvent = async (event: Omit<CalendarEvent, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.EVENTS), {
      title: event.title || '',
      description: event.description || '',
      observations: event.observations || null,
      location: event.location || null,
      formateurs: event.formateurs || [],
      createdAt: serverTimestamp(),
      date: Timestamp.fromDate(event.date)
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding event:', error);
    throw error;
  }
};

// Resource Services
export const addResource = async (resource: Omit<Resource, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.RESOURCES), {
      ...resource,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding resource:', error);
    throw error;
  }
};