import { useEffect, useRef } from "react";
import { Play, Pause, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { GlobalSettingsDialog } from "./GlobalSettingsDialog";

export const Timeline = () => {
  const { 
    clips, 
    isPlaying, 
    currentTime, 
    totalDuration,
    selectClip,
    selectedClipId,
    setIsPlaying,
    setCurrentTime,
    mediaItems,
    updateClip,
    updateTotalDuration
  } = useEditorStore();

  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = performance.now() - currentTime;
      const animate = (timestamp: number) => {
        const elapsed = timestamp - startTimeRef.current;
        
        if (elapsed >= totalDuration) {
          setCurrentTime(totalDuration);
          setIsPlaying(false);
        } else {
          setCurrentTime(elapsed);
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, totalDuration, setCurrentTime, setIsPlaying, currentTime]);

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const draggedClipRef = useRef<string | null>(null);
  const playheadDragRef = useRef(false);

  const handleTrackDrop = (e: React.DragEvent, track: string) => {
    e.preventDefault();
    const mediaId = e.dataTransfer.getData('mediaId');
    const mediaType = e.dataTransfer.getData('mediaType');
    const clipId = e.dataTransfer.getData('clipId');
    
    // Se está arrastando um clipe existente
    if (clipId) {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - 80;
      const dropTime = Math.max(0, offsetX * MS_PER_PIXEL);
      
      updateClip(clipId, { start: dropTime, track });
      updateTotalDuration();
      draggedClipRef.current = null;
      return;
    }
    
    // Se está arrastando uma nova mídia
    if (!mediaId || !mediaType) return;

    const mediaItem = mediaItems.find(m => m.id === mediaId);
    if (!mediaItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - 80;
    const dropTime = Math.max(0, offsetX * MS_PER_PIXEL);

    addClipFromDrop(mediaItem, track, dropTime);
  };

  const addClipFromDrop = (mediaItem: any, track: string, startTime: number) => {
    const { addClip, updateTotalDuration } = useEditorStore.getState();
    
    let duration = 3000;
    if (mediaItem.type === 'audio' && mediaItem.duration) {
      duration = mediaItem.duration;
    }

    const newClip = {
      id: `clip-${Date.now()}-${Math.random()}`,
      type: mediaItem.type,
      mediaId: mediaItem.id,
      track: track,
      start: startTime,
      duration: duration,
      scale: 1.0,
      brightness: 0,
      contrast: 0,
      volume: 1.0,
      speed: 1.0,
      opacity: 1.0,
    };

    addClip(newClip);
    updateTotalDuration();
  };

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    playheadDragRef.current = true;
    setIsPlaying(false);
  };

  const handlePlayheadMouseMove = (e: MouseEvent) => {
    if (!playheadDragRef.current) return;
    
    const container = document.querySelector('.tracks-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - 80;
    const newTime = Math.max(0, Math.min(totalDuration, offsetX * MS_PER_PIXEL));
    setCurrentTime(newTime);
  };

  const handlePlayheadMouseUp = () => {
    playheadDragRef.current = false;
  };

  useEffect(() => {
    document.addEventListener('mousemove', handlePlayheadMouseMove);
    document.addEventListener('mouseup', handlePlayheadMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handlePlayheadMouseMove);
      document.removeEventListener('mouseup', handlePlayheadMouseUp);
    };
  }, [totalDuration]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const frames = Math.floor((ms % 1000) / 41.666);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
  };

  const MS_PER_PIXEL = 10;
  const videoClips = clips.filter(c => c.track === 'V1');
  const audioClips = clips.filter(c => c.track === 'A1');

  return (
    <footer className="h-52 bg-[hsl(var(--timeline-bg))] border-t border-border flex flex-col">
      <div className="h-12 flex items-center gap-3 px-4 border-b border-border">
        <Button
          onClick={togglePlayback}
          variant="ghost"
          size="sm"
          disabled={clips.length === 0}
          className="hover:bg-muted"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-primary" />
          ) : (
            <Play className="w-5 h-5 text-primary" />
          )}
        </Button>

        <Button variant="ghost" size="sm" disabled className="hover:bg-muted">
          <Undo className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" disabled className="hover:bg-muted">
          <Redo className="w-4 h-4" />
        </Button>

        <div className="ml-6 flex items-center gap-6 text-sm">
          <span>Tempo: <span className="font-mono font-semibold">{formatTime(currentTime)}</span></span>
          <span>Duração: <span className="font-mono font-semibold">{formatTime(totalDuration)}</span></span>
        </div>

        <div className="ml-auto">
          <GlobalSettingsDialog />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden relative">
        {/* Track V1 - Video */}
        <div 
          className="h-14 flex bg-[hsl(var(--editor-panel))] mb-1 relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleTrackDrop(e, 'V1')}
        >
          <div className="w-20 min-w-20 flex items-center justify-center font-semibold bg-[hsl(var(--timeline-bg))] border-r border-border">
            V1
          </div>
          <div className="flex-1 relative" style={{ minWidth: `${Math.max(1200, totalDuration / MS_PER_PIXEL + 100)}px` }}>
            {videoClips.map(clip => {
              const mediaItem = mediaItems.find(m => m.id === clip.mediaId);
              return (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('clipId', clip.id);
                    draggedClipRef.current = clip.id;
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    draggedClipRef.current = null;
                  }}
                  onClick={() => selectClip(clip.id)}
                  className={`absolute h-10 top-2 rounded cursor-move transition-all ${
                    selectedClipId === clip.id 
                      ? 'bg-[hsl(var(--clip-video))]/90 border-2 border-primary' 
                      : 'bg-[hsl(var(--clip-video))] border-2 border-transparent hover:opacity-80'
                  }`}
                  style={{
                    left: `${clip.start / MS_PER_PIXEL}px`,
                    width: `${clip.duration / MS_PER_PIXEL}px`,
                  }}
                >
                  <div className="px-2 text-xs text-white truncate leading-10">
                    {mediaItem?.name || 'Clip'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Track A1 - Audio */}
        <div 
          className="h-14 flex bg-[hsl(var(--editor-panel))] relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleTrackDrop(e, 'A1')}
        >
          <div className="w-20 min-w-20 flex items-center justify-center font-semibold bg-[hsl(var(--timeline-bg))] border-r border-border">
            A1
          </div>
          <div className="flex-1 relative" style={{ minWidth: `${Math.max(1200, totalDuration / MS_PER_PIXEL + 100)}px` }}>
            {audioClips.map(clip => {
              const mediaItem = mediaItems.find(m => m.id === clip.mediaId);
              return (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('clipId', clip.id);
                    draggedClipRef.current = clip.id;
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    draggedClipRef.current = null;
                  }}
                  onClick={() => selectClip(clip.id)}
                  className={`absolute h-10 top-2 rounded cursor-move transition-all ${
                    selectedClipId === clip.id 
                      ? 'bg-[hsl(var(--clip-audio))]/90 border-2 border-primary' 
                      : 'bg-[hsl(var(--clip-audio))] border-2 border-transparent hover:opacity-80'
                  }`}
                  style={{
                    left: `${clip.start / MS_PER_PIXEL}px`,
                    width: `${clip.duration / MS_PER_PIXEL}px`,
                  }}
                >
                  <div className="px-2 text-xs text-white truncate leading-10">
                    {mediaItem?.name || 'Audio'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[hsl(var(--playhead))] z-10 cursor-col-resize"
          style={{
            left: `${80 + currentTime / MS_PER_PIXEL}px`,
          }}
          onMouseDown={handlePlayheadMouseDown}
        >
          <div 
            className="w-3 h-3 bg-[hsl(var(--playhead))] rounded-full -ml-1.5 -mt-1 cursor-grab active:cursor-grabbing"
            onMouseDown={handlePlayheadMouseDown}
          />
        </div>
      </div>
    </footer>
  );
};
