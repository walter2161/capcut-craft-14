import { useState, useRef } from "react";
import { FolderOpen, Music, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { toast } from "sonner";

type TabType = 'media' | 'audio';

export const ResourcePanel = () => {
  const [activeTab, setActiveTab] = useState<TabType>('media');
  const { mediaItems, addMediaItem, addClip } = useEditorStore();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio') => {
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
      id: `clip-${Date.now()}`,
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
  const audios = mediaItems.filter(m => m.type === 'audio');

  return (
    <aside className="w-64 bg-[hsl(var(--editor-panel))] border-r border-border flex flex-col">
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'media' 
              ? 'bg-background text-foreground border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          Mídia
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex-1 px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'audio' 
              ? 'bg-background text-foreground border-b-2 border-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Music className="w-4 h-4" />
          Áudio
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
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Imagens
            </Button>

            <div className="space-y-2">
              {images.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => handleAddToTimeline(item)}
                  className="bg-muted hover:bg-muted/80 rounded cursor-move transition-colors overflow-hidden"
                >
                  {item.thumbnail && (
                    <img 
                      src={item.thumbnail} 
                      alt={item.name}
                      className="w-full h-20 object-cover"
                    />
                  )}
                  <div className="p-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs truncate">{item.name}</span>
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
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleMediaUpload(e, 'audio')}
            />
            <Button
              onClick={() => audioInputRef.current?.click()}
              variant="secondary"
              className="w-full mb-4"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Áudio
            </Button>

            <div className="space-y-2">
              {audios.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => handleAddToTimeline(item)}
                  className="bg-muted hover:bg-muted/80 p-3 rounded cursor-move transition-colors flex items-center gap-2"
                >
                  <Music className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
