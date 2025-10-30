import { useRef, useEffect, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";

export const VideoPreview = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const { clips, mediaItems, currentTime, isPlaying, globalSettings } = useEditorStore();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderFrame(ctx, currentTime);
    
    // Gerenciar reprodução de áudio
    if (isPlaying) {
      playAudio(currentTime);
    } else {
      stopAudio();
    }
  }, [currentTime, clips, mediaItems, isPlaying]);

  const playAudio = (time: number) => {
    const audioClips = clips.filter(c => c.track === 'A1');
    const currentAudioClip = audioClips.find(
      c => c.start <= time && c.start + c.duration > time
    );

    if (!currentAudioClip) {
      stopAudio();
      return;
    }

    const mediaItem = mediaItems.find(m => m.id === currentAudioClip.mediaId);
    if (!mediaItem || !mediaItem.data) return;

    // Inicializar AudioContext se necessário
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    
    // Se já está tocando o mesmo clipe, não reiniciar
    if (audioSourceRef.current && audioSourceRef.current.buffer === mediaItem.data) {
      return;
    }

    // Parar áudio anterior
    stopAudio();

    try {
      // Criar novo source
      const source = audioContext.createBufferSource();
      source.buffer = mediaItem.data;
      
      // Criar gain node para controle de volume
      const gainNode = audioContext.createGain();
      gainNode.gain.value = currentAudioClip.volume;
      
      // Conectar nodes
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Calcular offset do áudio
      const timeInClip = (time - currentAudioClip.start) / 1000;
      const offset = Math.max(0, timeInClip / currentAudioClip.speed);
      
      // Aplicar velocidade
      source.playbackRate.value = currentAudioClip.speed;
      
      // Iniciar reprodução
      source.start(0, offset);
      
      audioSourceRef.current = source;
      gainNodeRef.current = gainNode;
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
    }
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignorar erro se já parado
      }
      audioSourceRef.current = null;
    }
  };

  const fitImageToCanvas = (img: any, canvas: HTMLCanvasElement) => {
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.width / img.height;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgRatio > canvasRatio) {
      drawWidth = canvas.width;
      drawHeight = drawWidth / imgRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      drawHeight = canvas.height;
      drawWidth = imgRatio * drawHeight;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    }
    
    return { drawWidth, drawHeight, offsetX, offsetY };
  };

  const renderFrame = (ctx: CanvasRenderingContext2D, time: number) => {
    const canvas = ctx.canvas;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const videoClips = clips.filter(c => c.track === 'V1').sort((a, b) => a.start - b.start);
    
    const currentClip = videoClips.find(
      c => c.start <= time && c.start + c.duration > time
    );

    if (!currentClip) return;

    const mediaItem = mediaItems.find(m => m.id === currentClip.mediaId);
    if (!mediaItem || !mediaItem.data) return;

    const image = mediaItem.data;
    const timeInClip = time - currentClip.start;
    const transitionDuration = currentClip.transitionDuration || 500;
    
    // Verificar se há um clipe seguinte para transição
    const currentIndex = videoClips.indexOf(currentClip);
    const nextClip = currentIndex < videoClips.length - 1 ? videoClips[currentIndex + 1] : null;
    
    let alpha = currentClip.opacity;
    
    // Lógica de transição cross-fade
    if (nextClip && (currentClip.transition === 'cross-fade' || !currentClip.transition)) {
      const transitionStart = currentClip.duration - transitionDuration;
      
      if (timeInClip >= transitionStart) {
        const transitionTime = timeInClip - transitionStart;
        const transitionProgress = transitionTime / transitionDuration;
        
        // Desenhar a próxima imagem (fundo)
        const nextMediaItem = mediaItems.find(m => m.id === nextClip.mediaId);
        if (nextMediaItem && nextMediaItem.data) {
          const nextImage = nextMediaItem.data;
          const nextImgProps = fitImageToCanvas(nextImage, canvas);
          
          ctx.filter = 'none';
          ctx.globalAlpha = 1;
          
          const nextScaledWidth = nextImgProps.drawWidth * nextClip.scale;
          const nextScaledHeight = nextImgProps.drawHeight * nextClip.scale;
          const nextOffsetX = (canvas.width - nextScaledWidth) / 2;
          const nextOffsetY = (canvas.height - nextScaledHeight) / 2;
          
          ctx.drawImage(nextImage, nextOffsetX, nextOffsetY, nextScaledWidth, nextScaledHeight);
        }
        
        // Ajustar alpha da imagem atual para fade out
        alpha = (1 - transitionProgress) * currentClip.opacity;
      }
    }
    
    // Desenhar a imagem atual
    const imgProps = fitImageToCanvas(image, canvas);
    
    ctx.filter = `brightness(${100 + currentClip.brightness}%) contrast(${100 + currentClip.contrast}%)`;
    ctx.globalAlpha = alpha;

    const scaledWidth = imgProps.drawWidth * currentClip.scale;
    const scaledHeight = imgProps.drawHeight * currentClip.scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  };

  // Calcular dimensões do canvas baseado no formato
  const getCanvasDimensions = () => {
    switch (globalSettings.videoFormat) {
      case '9:16':
        return { width: 720, height: 1280 };
      case '1:1':
        return { width: 1080, height: 1080 };
      case '16:9':
      default:
        return { width: 1280, height: 720 };
    }
  };

  const canvasDimensions = getCanvasDimensions();

  return (
    <section className="flex-1 bg-black flex items-center justify-center relative">
      <div className="absolute top-4 right-4 z-10 flex gap-2 items-center bg-black/70 px-3 py-2 rounded-lg backdrop-blur-sm">
        <span className="text-white text-sm font-semibold">{globalSettings.videoFormat}</span>
        <div className="flex gap-1 items-center border-l border-white/20 pl-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
          >
            -
          </Button>
          <span className="text-white text-xs min-w-10 text-center">{(zoom * 100).toFixed(0)}%</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
          >
            +
          </Button>
        </div>
      </div>
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <div className="relative" style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}>
          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            className="max-w-full max-h-full shadow-2xl"
            style={{
              border: '3px solid white',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.3)',
            }}
          />
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white text-xs bg-black/70 px-2 py-1 rounded whitespace-nowrap">
            {globalSettings.videoFormat}
          </div>
        </div>
        {clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground border border-dashed border-muted-foreground/30 rounded-lg p-8">
              <p className="text-lg">Importe e adicione clipes à linha do tempo.</p>
              <p className="text-sm mt-2">Clique em PLAY para pré-visualizar.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
