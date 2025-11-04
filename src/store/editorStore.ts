import { create } from 'zustand';

export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  name: string;
  data: any;
  duration?: number;
  thumbnail?: string;
  audioBlob?: Blob;
}

export interface Clip {
  id: string;
  type: 'image' | 'video' | 'audio' | 'subtitle';
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
  text?: string; // Texto da legenda
  readingSpeed?: number; // Velocidade de leitura (palavras por minuto)
}

export interface GlobalSettings {
  defaultImageDuration: number;
  defaultTransitionDuration: number;
  videoFPS: number;
  videoFormat: '16:9' | '9:16' | '1:1';
  mediaFitMode: 'fit-width' | 'fit-height' | 'contain';
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
  projectName: string;
  
  addMediaItem: (item: MediaItem) => void;
  removeMediaItem: (id: string) => void;
  addClip: (clip: Clip) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  removeClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  splitClip: (id: string, splitTime: number) => void;
  selectClip: (id: string | null, multiSelect?: boolean) => void;
  clearSelection: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  updateTotalDuration: () => void;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  setProjectName: (name: string) => void;
  loadProject: (data: any) => void;
  resetProject: () => void;
  clearTimelineAndMedia: () => void;
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
    videoFormat: '9:16',
    mediaFitMode: 'fit-height',
  },
  projectName: 'Post Imóvel 9:16',

  addMediaItem: (item) => set((state) => ({ 
    mediaItems: [...state.mediaItems, item] 
  })),

  removeMediaItem: (id) => set((state) => ({
    mediaItems: state.mediaItems.filter(item => item.id !== id),
    clips: state.clips.filter(clip => clip.mediaId !== id),
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

  removeClip: (id) => set((state) => {
    const newClips = state.clips.filter(clip => clip.id !== id);
    const newTotal = newClips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
    return {
      clips: newClips,
      totalDuration: newTotal,
      selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
      selectedClipIds: state.selectedClipIds.filter(clipId => clipId !== id)
    };
  }),

  duplicateClip: (id) => set((state) => {
    const clipToDuplicate = state.clips.find(c => c.id === id);
    if (!clipToDuplicate) return state;
    
    const newClip = {
      ...clipToDuplicate,
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      start: clipToDuplicate.start + clipToDuplicate.duration
    };
    
    return { clips: [...state.clips, newClip].sort((a, b) => a.start - b.start) };
  }),

  splitClip: (id, splitTime) => set((state) => {
    const clipToSplit = state.clips.find(c => c.id === id);
    if (!clipToSplit || splitTime <= clipToSplit.start || splitTime >= clipToSplit.start + clipToSplit.duration) {
      return state;
    }
    
    const firstPart = {
      ...clipToSplit,
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(2)}-1`,
      duration: splitTime - clipToSplit.start
    };
    
    const secondPart = {
      ...clipToSplit,
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(2)}-2`,
      start: splitTime,
      duration: (clipToSplit.start + clipToSplit.duration) - splitTime
    };
    
    const newClips = state.clips
      .filter(c => c.id !== id)
      .concat([firstPart, secondPart])
      .sort((a, b) => a.start - b.start);
    
    return { clips: newClips, selectedClipIds: [] };
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

  setProjectName: (name) => set({ projectName: name }),

  loadProject: (data) => set({
    mediaItems: data.mediaItems || [],
    clips: data.clips || [],
    globalSettings: data.globalSettings || get().globalSettings,
    projectName: data.projectName || 'Projeto Importado',
    selectedClipId: null,
    selectedClipIds: [],
    currentTime: 0,
  }),

  resetProject: () => {
    // Limpar também o localStorage primeiro, para evitar rehidratação acidental
    try {
      localStorage.removeItem('video-editor-autosave');
      localStorage.removeItem('video-editor-autosave-expiry');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }

    set({
      mediaItems: [],
      clips: [],
      selectedClipId: null,
      selectedClipIds: [],
      isPlaying: false,
      currentTime: 0,
      totalDuration: 0,
      projectName: 'Post Imóvel 9:16',
    });
  },

  clearTimelineAndMedia: () => set({
    mediaItems: [],
    clips: [],
    selectedClipId: null,
    selectedClipIds: [],
    currentTime: 0,
    totalDuration: 0,
  }),
}));
