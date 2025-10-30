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
    const data = {
      mediaItems,
      clips,
      globalSettings,
    };

    const expiryTime = Date.now() + (EXPIRY_HOURS * 60 * 60 * 1000);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
  }, [mediaItems, clips, globalSettings]);

  return null;
};
