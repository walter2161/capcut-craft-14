import { create } from 'zustand';

export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  name: string;
  data: any;
  duration?: number;
  thumbnail?: string;
}

export interface Clip {
  id: string;
  type: 'image' | 'video' | 'audio';
  mediaId: string;
  track: string;
  start: number;
  duration: number;
  scale: number;
  brightness: number;
  contrast: number;
  volume: number;
  speed: number;
  opacity: number;
  transition?: 'cross-fade' | 'none';
  transitionDuration?: number;
}

export interface GlobalSettings {
  defaultImageDuration: number;
  defaultTransitionDuration: number;
  videoFPS: number;
  videoFormat: '16:9' | '9:16' | '1:1';
}

interface EditorState {
  mediaItems: MediaItem[];
  clips: Clip[];
  selectedClipId: string | null;
  selectedClipIds: string[];
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  globalSettings: GlobalSettings;
  
  addMediaItem: (item: MediaItem) => void;
  addClip: (clip: Clip) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  removeClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  selectClip: (id: string | null, multiSelect?: boolean) => void;
  clearSelection: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  updateTotalDuration: () => void;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mediaItems: [],
  clips: [],
  selectedClipId: null,
  selectedClipIds: [],
  isPlaying: false,
  currentTime: 0,
  totalDuration: 0,
  globalSettings: {
    defaultImageDuration: 3000,
    defaultTransitionDuration: 500,
    videoFPS: 30,
    videoFormat: '16:9',
  },

  addMediaItem: (item) => set((state) => ({ 
    mediaItems: [...state.mediaItems, item] 
  })),

  addClip: (clip) => set((state) => {
    const newClips = [...state.clips, clip].sort((a, b) => a.start - b.start);
    return { clips: newClips };
  }),

  updateClip: (id, updates) => set((state) => ({
    clips: state.clips.map(clip => 
      clip.id === id ? { ...clip, ...updates } : clip
    )
  })),

  removeClip: (id) => set((state) => ({
    clips: state.clips.filter(clip => clip.id !== id),
    selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
    selectedClipIds: state.selectedClipIds.filter(clipId => clipId !== id)
  })),

  duplicateClip: (id) => set((state) => {
    const clipToDuplicate = state.clips.find(c => c.id === id);
    if (!clipToDuplicate) return state;
    
    const newClip = {
      ...clipToDuplicate,
      id: `clip-${Date.now()}-${Math.random()}`,
      start: clipToDuplicate.start + clipToDuplicate.duration
    };
    
    return { clips: [...state.clips, newClip].sort((a, b) => a.start - b.start) };
  }),

  selectClip: (id, multiSelect = false) => set((state) => {
    if (!id) {
      return { selectedClipId: null, selectedClipIds: [] };
    }
    
    if (multiSelect) {
      const isSelected = state.selectedClipIds.includes(id);
      return {
        selectedClipId: id,
        selectedClipIds: isSelected 
          ? state.selectedClipIds.filter(clipId => clipId !== id)
          : [...state.selectedClipIds, id]
      };
    }
    
    return { selectedClipId: id, selectedClipIds: [id] };
  }),

  clearSelection: () => set({ selectedClipId: null, selectedClipIds: [] }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setCurrentTime: (time) => set({ currentTime: time }),

  updateTotalDuration: () => set((state) => {
    const duration = state.clips.reduce((max, clip) => 
      Math.max(max, clip.start + clip.duration), 0
    );
    return { totalDuration: duration };
  }),

  updateGlobalSettings: (settings) => set((state) => ({
    globalSettings: { ...state.globalSettings, ...settings }
  })),
}));
