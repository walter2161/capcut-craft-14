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

interface EditorState {
  mediaItems: MediaItem[];
  clips: Clip[];
  selectedClipId: string | null;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  
  addMediaItem: (item: MediaItem) => void;
  addClip: (clip: Clip) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  removeClip: (id: string) => void;
  selectClip: (id: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  updateTotalDuration: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mediaItems: [],
  clips: [],
  selectedClipId: null,
  isPlaying: false,
  currentTime: 0,
  totalDuration: 0,

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
    selectedClipId: state.selectedClipId === id ? null : state.selectedClipId
  })),

  selectClip: (id) => set({ selectedClipId: id }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setCurrentTime: (time) => set({ currentTime: time }),

  updateTotalDuration: () => set((state) => {
    const duration = state.clips.reduce((max, clip) => 
      Math.max(max, clip.start + clip.duration), 0
    );
    return { totalDuration: duration };
  }),
}));
