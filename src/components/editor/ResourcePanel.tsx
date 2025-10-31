import { useState, useRef } from "react";
import { FolderOpen, Music, Upload, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { toast } from "sonner";

type TabType = 'media' | 'video' | 'audio';

export const ResourcePanel = () => {
  const [activeTab, setActiveTab] = useState<TabType>('media');
  const { mediaItems, addMediaItem, removeMediaItem, addClip } = useEditorStore();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'audio') => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      const reader = new FileReader();
      const mediaId = `media-${Date.now()}-${Math.random().toString(36).substring(2)}`;

      if (type === 'image') {
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            addMediaItem({
              id: mediaId,
              type: 'image',
              name: file.name,
              data: img,
              thumbnail: event.target?.result as string
            });
            toast.success(`Imagem "${file.name}" adicionada`);
          };
          img.onerror = () => {
            toast.error(`Erro ao carregar "${file.name}"`);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else if (type === 'video') {
        reader.onload = (event) => {
          const video = document.createElement('video');
          video.onloadedmetadata = () => {
            // Generate thumbnail only once to avoid duplicates when video currentTime changes later
            video.onseeked = () => {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumbnail = canvas.toDataURL('image/jpeg');
              
              addMediaItem({
                id: mediaId,
                type: 'video',
                name: file.name,
                data: video,
                duration: video.duration * 1000,
                thumbnail
              });
              toast.success(`Vídeo "${file.name}" adicionado`);

              // Important: prevent adding the same media again on future seek events
              video.onseeked = null;
            };

            try {
              video.currentTime = 0.1;
            } catch {}
          };
          video.onerror = () => {
            toast.error(`Erro ao carregar vídeo "${file.name}"`);
          };
          video.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else if (type === 'audio') {
        reader.onload = async (event) => {
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            addMediaItem({
              id: mediaId,
              type: 'audio',
              name: file.name,
              data: audioBuffer,
              duration: audioBuffer.duration * 1000
            });
            toast.success(`Áudio "${file.name}" adicionado`);
          } catch (error) {
            toast.error("Erro ao carregar áudio");
          }
        };
        reader.readAsArrayBuffer(file);
      }
    }
  };

  const handleAddToTimeline = (item: any) => {
    const track = item.type === 'audio' ? 'A1' : 'V1';
    const duration = item.type === 'audio' ? item.duration : 3000;
    
    // Encontrar a última posição na trilha
    const clipsInTrack = useEditorStore.getState().clips.filter(c => c.track === track);
    const lastPosition = clipsInTrack.reduce((max, clip) => 
      Math.max(max, clip.start + clip.duration), 0
    );
    
    addClip({
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      type: item.type,
      mediaId: item.id,
      track,
      start: lastPosition,
      duration,
      scale: 1,
      brightness: 0,
      contrast: 0,
      volume: 1,
      speed: 1,
      opacity: 1,
      transition: 'cross-fade',
      transitionDuration: 500
    });
    
    useEditorStore.getState().updateTotalDuration();
    toast.success(`Adicionado à linha do tempo`);
  };

  const handleDragStart = (e: React.DragEvent, item: any) => {
    e.dataTransfer.setData('mediaId', item.id);
    e.dataTransfer.setData('mediaType', item.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const images = mediaItems.filter(m => m.type === 'image');
  const videos = mediaItems.filter(m => m.type === 'video');
  const audios = mediaItems.filter(m => m.type === 'audio');

  return (
    <aside className="w-64 bg-[hsl(var(--editor-panel))] border-r border-border flex flex-col">
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 px-2 py-3 flex items-center justify-center transition-colors ${
            activeTab === 'media' 
              ? 'bg-background text-foreground border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Imagens"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 px-2 py-3 flex items-center justify-center transition-colors ${
            activeTab === 'video' 
              ? 'bg-background text-foreground border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Vídeos"
        >
          <Video className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex-1 px-2 py-3 flex items-center justify-center transition-colors ${
            activeTab === 'audio' 
              ? 'bg-background text-foreground border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Áudio"
        >
          <Music className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'media' && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleMediaUpload(e, 'image')}
            />
            <Button
              onClick={() => imageInputRef.current?.click()}
              variant="secondary"
              className="w-full mb-4"
              size="sm"
            >
              <Upload className="w-4 h-4" />
            </Button>

            <div className="grid grid-cols-3 gap-2">
              {images.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => handleAddToTimeline(item)}
                  className="relative bg-muted hover:bg-muted/80 rounded cursor-move transition-colors overflow-hidden group"
                >
                  {item.thumbnail && (
                    <img 
                      src={item.thumbnail} 
                      alt={item.name}
                      className="w-full h-16 object-cover"
                    />
                  )}
                  <div className="absolute top-1 right-1 bg-blue-500 text-white text-[10px] px-1 rounded">
                    IMG
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMediaItem(item.id);
                      toast.success(`"${item.name}" removido`);
                    }}
                    className="absolute top-1 left-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                    title="Deletar mídia"
                  >
                    ×
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate">
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'video' && (
          <>
            <input
              ref={videoInputRef}
              type="file"
              multiple
              accept="video/*"
              className="hidden"
              onChange={(e) => handleMediaUpload(e, 'video')}
            />
            <Button
              onClick={() => videoInputRef.current?.click()}
              variant="secondary"
              className="w-full mb-4"
              size="sm"
            >
              <Upload className="w-4 h-4" />
            </Button>

            <div className="grid grid-cols-3 gap-2">
              {videos.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => handleAddToTimeline(item)}
                  className="relative bg-muted hover:bg-muted/80 rounded cursor-move transition-colors overflow-hidden group"
                >
                  {item.thumbnail && (
                    <img 
                      src={item.thumbnail} 
                      alt={item.name}
                      className="w-full h-16 object-cover"
                    />
                  )}
                  <div className="absolute top-1 right-1 bg-purple-500 text-white text-[10px] px-1 rounded">
                    VID
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMediaItem(item.id);
                      toast.success(`"${item.name}" removido`);
                    }}
                    className="absolute top-1 left-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                    title="Deletar mídia"
                  >
                    ×
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate">
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'audio' && (
          <>
            <input
              ref={audioInputRef}
              type="file"
              multiple
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleMediaUpload(e, 'audio')}
            />
            <Button
              onClick={() => audioInputRef.current?.click()}
              variant="secondary"
              className="w-full mb-4"
              size="sm"
            >
              <Upload className="w-4 h-4" />
            </Button>

            <div className="space-y-2">
              {audios.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => handleAddToTimeline(item)}
                  className="bg-muted hover:bg-muted/80 p-2 rounded cursor-move transition-colors flex items-center gap-2 group relative"
                >
                  <div className="relative">
                    <Music className="w-6 h-6 text-muted-foreground" />
                    <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] px-1 rounded">
                      AUD
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    {item.duration && (
                      <p className="text-[10px] text-muted-foreground">
                        {(item.duration / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMediaItem(item.id);
                      toast.success(`"${item.name}" removido`);
                    }}
                    className="bg-red-500 text-white text-xs w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600 shrink-0"
                    title="Deletar mídia"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
