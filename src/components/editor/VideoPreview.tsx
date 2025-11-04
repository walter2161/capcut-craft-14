import { useRef, useEffect, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";

// Singleton para gerenciar a síntese de voz
let currentUtterance: SpeechSynthesisUtterance | null = null;

export const VideoPreview = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const { clips, mediaItems, currentTime, isPlaying, globalSettings } = useEditorStore();
  const [zoom, setZoom] = useState(1);
  const [, forceRerender] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const lastSpokenSubtitleRef = useRef<string>('');

  // Resolve a drawable element for a media item (preloads images from URL strings)
  const getDrawable = (item: { type: 'image' | 'video' | 'audio'; data: any }): HTMLImageElement | HTMLVideoElement | null => {
    if (!item) return null;

    if (item.type === 'image') {
      const data = item.data;
      // Already an HTMLImageElement and loaded
      if (data instanceof HTMLImageElement) {
        if (!data.complete || data.naturalWidth === 0 || data.naturalHeight === 0) return null;
        return data;
      }
      // If it's a string URL, try to load without CORS for preview
      if (typeof data === 'string') {
        const cached = imageCacheRef.current.get(data);
        if (cached && cached.complete && cached.naturalWidth > 0) {
          return cached;
        }
        // Try to load without CORS restrictions for preview
        const img = new Image();
        img.onload = () => {
          imageCacheRef.current.set(data, img);
          forceRerender((t) => t + 1);
        };
        img.onerror = () => {
          console.warn('Failed to load image for preview:', data);
        };
        img.src = data;
        imageCacheRef.current.set(data, img);
        // Return immediately if dimensions are available, even if not complete
        if (img.naturalWidth > 0 || img.width > 0) {
          return img;
        }
        return null;
      }
      return null;
    }

    if (item.type === 'video' && item.data instanceof HTMLVideoElement) {
      return item.data as HTMLVideoElement;
    }

    return null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderFrame(ctx, currentTime);
    
    // Gerenciar reprodução de áudio
    if (isPlaying) {
      playAudio(currentTime);
      handleSubtitles(currentTime);
    } else {
      stopAudio();
      stopSpeech();
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
    if (!mediaItem || !mediaItem.data) {
      console.warn('Media item não encontrado ou sem dados de áudio');
      return;
    }

    // Verificar se é um AudioBuffer válido
    if (!(mediaItem.data instanceof AudioBuffer)) {
      console.error('Dados da mídia não são um AudioBuffer:', mediaItem);
      return;
    }

    // Inicializar AudioContext se necessário
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    
    // Retomar o contexto se estiver suspenso
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Parar áudio anterior
    stopAudio();

    try {
      // Criar novo source (SEMPRE criar novo, não pode reutilizar)
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
      
      // Calcular duração restante
      const remainingDuration = Math.max(0, (currentAudioClip.duration / 1000) - timeInClip);
      
      // Iniciar reprodução
      source.start(0, offset, remainingDuration);
      
      audioSourceRef.current = source;
      gainNodeRef.current = gainNode;
      
      console.log('Áudio iniciado:', {
        clipId: currentAudioClip.id,
        offset,
        duration: remainingDuration,
        volume: currentAudioClip.volume
      });
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

  const handleSubtitles = (time: number) => {
    const subtitleClips = clips.filter(c => c.type === 'subtitle');
    const currentClip = subtitleClips.find(
      c => c.start <= time && c.start + c.duration > time
    );

    if (currentClip && currentClip.text) {
      setCurrentSubtitle(currentClip.text);
      
      // Reproduzir voz apenas se for uma nova legenda
      if (lastSpokenSubtitleRef.current !== currentClip.text) {
        speakText(currentClip.text);
        lastSpokenSubtitleRef.current = currentClip.text;
      }
    } else {
      setCurrentSubtitle('');
      if (lastSpokenSubtitleRef.current) {
        stopSpeech();
        lastSpokenSubtitleRef.current = '';
      }
    }
  };

  const speakText = (text: string) => {
    // Parar qualquer fala em andamento
    if (currentUtterance) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if (currentUtterance) {
      window.speechSynthesis.cancel();
      currentUtterance = null;
    }
  };

  const fitImageToCanvas = (media: any, canvas: HTMLCanvasElement) => {
    // Support Image, HTMLVideoElement, and CanvasImageSource
    const srcWidth = media?.videoWidth || media?.naturalWidth || media?.width || 0;
    const srcHeight = media?.videoHeight || media?.naturalHeight || media?.height || 0;

    if (!srcWidth || !srcHeight) {
      return { drawWidth: canvas.width, drawHeight: canvas.height, offsetX: 0, offsetY: 0 };
    }

    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = srcWidth / srcHeight;
    
    let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;
    
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

    const videoClips = clips.filter(c => c.track.startsWith('V')).sort((a, b) => a.start - b.start);
    
    const currentClip = videoClips.find(
      c => c.start <= time && c.start + c.duration > time
    );

    if (!currentClip) return;

    const mediaItem = mediaItems.find(m => m.id === currentClip.mediaId);
    if (!mediaItem || !mediaItem.data) {
      console.warn('Media item not found or has no data:', currentClip.mediaId);
      return;
    }

    // Suporte para vídeo e imagem
    const media = getDrawable(mediaItem);
    if (!media) return;
    const timeInClip = time - currentClip.start;
    const transitionDuration = currentClip.transitionDuration || 500;
    
    // Se for vídeo, atualizar o currentTime
    if (mediaItem.type === 'video' && media instanceof HTMLVideoElement) {
      const videoTime = (timeInClip / 1000) * currentClip.speed;
      
      // Check if video has valid dimensions and is ready to play
      if (media.videoWidth === 0 || media.videoHeight === 0) {
        console.warn('Video has invalid dimensions:', media.videoWidth, media.videoHeight);
        return;
      }
      
      // Update video time
      if (Math.abs(media.currentTime - videoTime) > 0.1) {
        media.currentTime = Math.max(0, Math.min(videoTime, media.duration || 0));
      }
      
      // Make sure video is ready for drawing
      if (media.readyState < 2) {
        console.log('Video not ready for drawing, readyState:', media.readyState);
        return;
      }
    }
    
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
        
        // Desenhar a próxima imagem/vídeo (fundo)
        const nextMediaItem = mediaItems.find(m => m.id === nextClip.mediaId);
        if (nextMediaItem) {
          const nextMedia = getDrawable(nextMediaItem as any);
          if (nextMedia) {
            const nextImgProps = fitImageToCanvas(nextMedia, canvas);
            
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            
            const nextScaledWidth = nextImgProps.drawWidth * nextClip.scale;
            const nextScaledHeight = nextImgProps.drawHeight * nextClip.scale;
            const nextOffsetX = (canvas.width - nextScaledWidth) / 2;
            const nextOffsetY = (canvas.height - nextScaledHeight) / 2;
            
            ctx.drawImage(nextMedia, nextOffsetX, nextOffsetY, nextScaledWidth, nextScaledHeight);
          }
        }
        
        // Ajustar alpha da mídia atual para fade out
        alpha = (1 - transitionProgress) * currentClip.opacity;
      }
    }
    
    // Desenhar a mídia atual (imagem ou vídeo)
    const imgProps = fitImageToCanvas(media, canvas);
    
    ctx.filter = `brightness(${100 + currentClip.brightness}%) contrast(${100 + currentClip.contrast}%)`;
    ctx.globalAlpha = alpha;

    const scaledWidth = imgProps.drawWidth * currentClip.scale;
    const scaledHeight = imgProps.drawHeight * currentClip.scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    ctx.drawImage(media, offsetX, offsetY, scaledWidth, scaledHeight);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  };

  // Calcular dimensões do canvas baseado no formato
  const getCanvasDimensions = () => {
    switch (globalSettings.videoFormat) {
      case '9:16':
        return { width: 1080, height: 1920 };
      case '1:1':
        return { width: 1080, height: 1080 };
      case '16:9':
      default:
        return { width: 1920, height: 1080 };
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
            id="preview-canvas"
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
          
          {/* Legendas */}
          {currentSubtitle && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-lg text-center max-w-[90%] backdrop-blur-sm">
              <p className="text-base font-semibold leading-relaxed">
                {currentSubtitle}
              </p>
            </div>
          )}
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
