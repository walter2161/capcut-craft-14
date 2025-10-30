import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';

const STORAGE_KEY = 'video-editor-autosave';
const EXPIRY_KEY = 'video-editor-autosave-expiry';
const EXPIRY_HOURS = 24;

export const useAutoSave = () => {
  const { mediaItems, clips, globalSettings } = useEditorStore();

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const expiry = localStorage.getItem(EXPIRY_KEY);
    
    if (saved && expiry) {
      const expiryTime = parseInt(expiry);
      const now = Date.now();
      
      if (now < expiryTime) {
        try {
          const data = JSON.parse(saved);
          const store = useEditorStore.getState();
          
          // Restore state
          data.mediaItems?.forEach((item: any) => store.addMediaItem(item));
          data.clips?.forEach((clip: any) => store.addClip(clip));
          if (data.globalSettings) store.updateGlobalSettings(data.globalSettings);
          
          console.log('Auto-save restored from localStorage');
        } catch (error) {
          console.error('Error restoring auto-save:', error);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(EXPIRY_KEY);
        }
      } else {
        // Expired, clear storage
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(EXPIRY_KEY);
      }
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    // Remove binary data from mediaItems to avoid quota issues
    const mediaItemsWithoutData = mediaItems.map(item => ({
      id: item.id,
      type: item.type,
      name: item.name,
      duration: item.duration,
      thumbnail: item.thumbnail,
      // Omit 'data' property which contains large binary data
    }));

    const data = {
      mediaItems: mediaItemsWithoutData,
      clips,
      globalSettings,
    };

    const expiryTime = Date.now() + (EXPIRY_HOURS * 60 * 60 * 1000);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
    } catch (error) {
      // If quota exceeded or other error, clear old data and try again with minimal data
      console.warn('Failed to save to localStorage:', error);
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(EXPIRY_KEY);
        // Try saving only clips and settings (most important for recovery)
        const minimalData = {
          clips,
          globalSettings,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalData));
        localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
      } catch (retryError) {
        console.error('Could not save even minimal data:', retryError);
        // Silently fail - don't crash the app
      }
    }
  }, [mediaItems, clips, globalSettings]);

  return null;
};
