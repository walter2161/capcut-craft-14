import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Scissors, Plus } from "lucide-react";
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
    selectedClipIds,
    setIsPlaying,
    setCurrentTime,
    mediaItems,
    updateClip,
    updateTotalDuration,
    removeClip,
    duplicateClip,
    splitClip
  } = useEditorStore();

  const [tracks, setTracks] = useState(['V1', 'A1']);
  const [zoom, setZoom] = useState(1);

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
  const dragOffsetRef = useRef<number>(0);
  const playheadDragRef = useRef(false);
  const SNAP_THRESHOLD = 50; // pixels para snap magnético

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
      const offsetX = e.clientX - rect.left - 80 - dragOffsetRef.current;
      let dropTime = Math.max(0, offsetX * MS_PER_PIXEL);
      
      // Snap magnético: colar em outros clipes próximos
      const otherClips = clips.filter(c => c.id !== clipId && c.track === track);
      for (const otherClip of otherClips) {
        const otherStart = otherClip.start;
        const otherEnd = otherClip.start + otherClip.duration;
        
        // Snap ao início do outro clipe
        if (Math.abs(dropTime - otherStart) < SNAP_THRESHOLD * MS_PER_PIXEL) {
          dropTime = otherStart;
          break;
        }
        
        // Snap ao final do outro clipe
        if (Math.abs(dropTime - otherEnd) < SNAP_THRESHOLD * MS_PER_PIXEL) {
          dropTime = otherEnd;
          break;
        }
        
        // Snap do final do clipe atual ao início do outro
        const clipEnd = dropTime + clip.duration;
        if (Math.abs(clipEnd - otherStart) < SNAP_THRESHOLD * MS_PER_PIXEL) {
          dropTime = otherStart - clip.duration;
          break;
        }
      }
      
      updateClip(clipId, { start: dropTime, track });
      updateTotalDuration();
      draggedClipRef.current = null;
      dragOffsetRef.current = 0;
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
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(2)}`,
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

  const MS_PER_PIXEL = 10 / zoom;

  const handleDeleteSelected = () => {
    selectedClipIds.forEach(id => removeClip(id));
  };

  const handleDuplicateSelected = () => {
    selectedClipIds.forEach(id => duplicateClip(id));
  };

  const handleSplitAtPlayhead = () => {
    if (selectedClipIds.length === 0) return;
    selectedClipIds.forEach(id => {
      const clip = clips.find(c => c.id === id);
      if (clip && currentTime > clip.start && currentTime < clip.start + clip.duration) {
        splitClip(id, currentTime);
      }
    });
  };

  const skipBackward = () => {
    setCurrentTime(Math.max(0, currentTime - 1000));
    setIsPlaying(false);
  };

  const skipForward = () => {
    setCurrentTime(Math.min(totalDuration, currentTime + 1000));
    setIsPlaying(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDeleteSelected();
    } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleDuplicateSelected();
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSplitAtPlayhead();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds]);

  return (
    <footer className="h-52 bg-[hsl(var(--timeline-bg))] border-t border-border flex flex-col">
      {/* Ferramentas de Edição */}
      <div className="h-10 flex items-center justify-between gap-3 px-4 border-b border-border bg-[hsl(var(--editor-panel))]">
        <div className="flex gap-2 items-center">
          {selectedClipIds.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={handleSplitAtPlayhead} className="hover:bg-muted" title="Cortar no playhead (Ctrl+S)">
                <Scissors className="w-4 h-4 mr-1" />
                Cortar
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDuplicateSelected} className="hover:bg-muted" title="Duplicar (Ctrl+D)">
                <i className="fas fa-copy w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDeleteSelected} className="hover:bg-muted text-destructive" title="Deletar (Del)">
                <i className="fas fa-trash w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex gap-1 items-center">
          <span className="text-xs mr-2">Zoom:</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="h-6 w-6 p-0 hover:bg-muted"
          >
            -
          </Button>
          <span className="text-xs min-w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            className="h-6 w-6 p-0 hover:bg-muted"
          >
            +
          </Button>
        </div>

        <GlobalSettingsDialog />
      </div>

      {/* Controles de Playback - Centralizados */}
      <div className="h-12 flex items-center justify-center gap-3 px-4 border-b border-border relative">
        <div className="absolute left-4 flex items-center gap-4 text-sm">
          <span>Tempo: <span className="font-mono font-semibold">{formatTime(currentTime)}</span></span>
          <span>Duração: <span className="font-mono font-semibold">{formatTime(totalDuration)}</span></span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={skipBackward}
            variant="ghost"
            size="sm"
            disabled={clips.length === 0}
            className="hover:bg-muted"
            title="Retroceder 1s"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          
          <Button
            onClick={togglePlayback}
            variant="ghost"
            size="sm"
            disabled={clips.length === 0}
            className="hover:bg-muted"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-primary" />
            ) : (
              <Play className="w-6 h-6 text-primary" />
            )}
          </Button>

          <Button
            onClick={skipForward}
            variant="ghost"
            size="sm"
            disabled={clips.length === 0}
            className="hover:bg-muted"
            title="Avançar 1s"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden relative tracks-container">
        {tracks.map((trackName, idx) => {
          const trackClips = clips.filter(c => c.track === trackName);
          const isVideoTrack = trackName.startsWith('V');
          
          return (
            <div 
              key={trackName}
              className="h-14 flex bg-[hsl(var(--editor-panel))] mb-1 relative"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleTrackDrop(e, trackName)}
            >
              <div className="w-20 min-w-20 flex items-center justify-center font-semibold bg-[hsl(var(--timeline-bg))] border-r border-border">
                {trackName}
              </div>
              <div className="flex-1 relative" style={{ minWidth: `${Math.max(1200, totalDuration / MS_PER_PIXEL + 100)}px` }}>
                {trackClips.map(clip => {
                  const mediaItem = mediaItems.find(m => m.id === clip.mediaId);
                  return (
                    <div
                      key={clip.id}
                      draggable
                      onDragStart={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        dragOffsetRef.current = e.clientX - rect.left;
                        e.dataTransfer.setData('clipId', clip.id);
                        draggedClipRef.current = clip.id;
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        draggedClipRef.current = null;
                        dragOffsetRef.current = 0;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectClip(clip.id, e.shiftKey);
                      }}
                      className={`absolute h-10 top-2 rounded transition-all overflow-hidden cursor-move group ${
                        selectedClipIds.includes(clip.id)
                          ? isVideoTrack 
                            ? 'bg-[hsl(var(--clip-video))]/90 border-2 border-primary'
                            : 'bg-[hsl(var(--clip-audio))]/90 border-2 border-primary'
                          : isVideoTrack
                            ? 'bg-[hsl(var(--clip-video))] border-2 border-transparent hover:opacity-80'
                            : 'bg-[hsl(var(--clip-audio))] border-2 border-transparent hover:opacity-80'
                      }`}
                      style={{
                        left: `${clip.start / MS_PER_PIXEL}px`,
                        width: `${clip.duration / MS_PER_PIXEL}px`,
                      }}
                    >
                      {mediaItem?.thumbnail && (
                        <img 
                          src={mediaItem.thumbnail} 
                          alt={mediaItem.name}
                          className="absolute inset-0 w-full h-full object-cover opacity-30"
                        />
                      )}
                      <div className="px-2 text-xs text-white truncate leading-10 relative z-10 flex items-center justify-between">
                        <span className="truncate flex-1">{mediaItem?.name || 'Clip'}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeClip(clip.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:text-red-500"
                          title="Deletar clip"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const nextVideoNum = tracks.filter(t => t.startsWith('V')).length + 1;
            const nextAudioNum = tracks.filter(t => t.startsWith('A')).length + 1;
            setTracks([...tracks, `V${nextVideoNum}`, `A${nextAudioNum}`]);
          }}
          className="ml-20 my-2 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Adicionar Track
        </Button>

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
