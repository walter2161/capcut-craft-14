import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';

const STORAGE_KEY = 'video-editor-autosave';
const EXPIRY_KEY = 'video-editor-autosave-expiry';
const EXPIRY_HOURS = 24;

export const useAutoSave = () => {
  const { clips, globalSettings } = useEditorStore();

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
          
          // Restore only clips and settings (not mediaItems since they don't have binary data)
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
    // Only save clips and settings (not mediaItems since they contain large binary data)
    const data = {
      clips,
      globalSettings,
    };

    const expiryTime = Date.now() + (EXPIRY_HOURS * 60 * 60 * 1000);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
      // Silently fail - don't crash the app
    }
  }, [clips, globalSettings]);

  return null;
};
