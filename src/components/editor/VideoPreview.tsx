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
  const { clips, mediaItems, currentTime, isPlaying, globalSettings, trackStates, thumbnailData } = useEditorStore();
  const [zoom, setZoom] = useState(1);
  const [, forceRerender] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const lastSpokenSubtitleRef = useRef<string>('');
  const currentAudioClipRef = useRef<string | null>(null);
  const lastRenderTimeRef = useRef<number>(0);

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

    // Evitar re-renders muito rápidos
    const now = Date.now();
    if (now - lastRenderTimeRef.current < 16) return; // ~60fps max
    lastRenderTimeRef.current = now;

    renderFrame(ctx, currentTime);
    
    // Gerenciar reprodução de áudio
    if (isPlaying) {
      playAudio(currentTime);
      handleSubtitles(currentTime);
    } else {
      stopAudio();
      stopSpeech();
      currentAudioClipRef.current = null;
    }
  }, [currentTime, clips, mediaItems, isPlaying]);

  const playAudio = (time: number) => {
    const audioClips = clips.filter(c => c.type === 'audio');
    const currentAudioClip = audioClips.find(
      c => c.start <= time && c.start + c.duration > time
    );

    // Verificar se o track está mutado
    const trackState = trackStates.find(t => t.name === currentAudioClip?.track);
    const isMuted = trackState?.muted || false;

    // Se mudou de clip ou não há clip ou está mutado, parar áudio atual
    const clipId = currentAudioClip?.id || null;
    if (clipId !== currentAudioClipRef.current || isMuted) {
      stopAudio();
      currentAudioClipRef.current = clipId;
    }

    if (!currentAudioClip || isMuted) {
      return;
    }

    // Se já está tocando o clip correto, não fazer nada
    if (audioSourceRef.current && clipId === currentAudioClipRef.current) {
      return;
    }

    const mediaItem = mediaItems.find(m => m.id === currentAudioClip.mediaId);
    if (!mediaItem || !mediaItem.data) {
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
      
      // Calcular duração restante
      const remainingDuration = Math.max(0, (currentAudioClip.duration / 1000) - timeInClip);
      
      // Iniciar reprodução
      source.start(0, offset, remainingDuration);
      
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

  const handleSubtitles = (time: number) => {
    const subtitleClips = clips.filter(c => c.type === 'subtitle');
    const currentClip = subtitleClips.find(
      c => c.start <= time && c.start + c.duration > time
    );

    // Verificar se o track está mutado ou oculto
    const trackState = trackStates.find(t => t.name === currentClip?.track);
    const isMuted = trackState?.muted || false;
    const isHidden = trackState?.hidden || false;

    if (currentClip && currentClip.text && !isHidden) {
      setCurrentSubtitle(currentClip.text);
      
      // Reproduzir voz apenas se for uma nova legenda e não estiver mutado
      if (lastSpokenSubtitleRef.current !== currentClip.text && !isMuted) {
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
    const fitMode = globalSettings?.mediaFitMode || 'fit-height';
    
    let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;
    
    if (fitMode === 'fit-width') {
      // Expandida na horizontal - preencher largura
      drawWidth = canvas.width;
      drawHeight = drawWidth / imgRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    } else if (fitMode === 'fit-height') {
      // Expandida na vertical - preencher altura
      drawHeight = canvas.height;
      drawWidth = imgRatio * drawHeight;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    } else {
      // Contida - a mídia inteira visível dentro do canvas
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
    }
    
    return { drawWidth, drawHeight, offsetX, offsetY };
  };

  const renderThumbnail = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Pegar a primeira imagem dos clips
    const firstImageClip = clips.find(c => c.type === 'image' && c.track.startsWith('V'));
    if (!firstImageClip) return;

    const mediaItem = mediaItems.find(m => m.id === firstImageClip.mediaId);
    if (!mediaItem) return;

    const media = getDrawable(mediaItem);
    if (!media) return;

    // Desenhar a imagem de fundo
    const imgProps = fitImageToCanvas(media, canvas);
    ctx.drawImage(media, imgProps.offsetX, imgProps.offsetY, imgProps.drawWidth, imgProps.drawHeight);

    // Calcular área 1:1 centralizada
    const squareSize = Math.min(canvas.width, canvas.height);
    const squareX = (canvas.width - squareSize) / 2;
    const squareY = (canvas.height - squareSize) / 2;

    // Overlay semi-transparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Card centralizado
    const cardPadding = squareSize * 0.1;
    const cardX = squareX + cardPadding;
    const cardY = squareY + cardPadding;
    const cardWidth = squareSize - (cardPadding * 2);
    const cardHeight = squareSize - (cardPadding * 2);

    // Fundo do card com gradiente
    const gradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(1, 'rgba(240, 240, 240, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    // Borda do card
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);

    // Renderizar conteúdo
    const fontSize = squareSize * 0.05;
    const lineHeight = fontSize * 1.5;
    let currentY = cardY + cardHeight * 0.15;

    // Título
    if (thumbnailData.title) {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `bold ${fontSize * 1.4}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(thumbnailData.title, cardX + cardWidth / 2, currentY);
      currentY += lineHeight * 2;
    }

    // Preço
    if (thumbnailData.price) {
      ctx.fillStyle = '#16a34a';
      ctx.font = `bold ${fontSize * 1.8}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(thumbnailData.price, cardX + cardWidth / 2, currentY);
      currentY += lineHeight * 2.5;
    }

    // Características em grid
    const iconSize = fontSize * 0.9;
    const startY = currentY;
    const itemSpacing = cardWidth * 0.25;

    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';

    if (thumbnailData.bedrooms) {
      const x = cardX + cardWidth * 0.25;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText('🛏️', x, startY);
      ctx.fillText(`${thumbnailData.bedrooms} quartos`, x, startY + lineHeight);
    }

    if (thumbnailData.bathrooms) {
      const x = cardX + cardWidth * 0.75;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText('🚿', x, startY);
      ctx.fillText(`${thumbnailData.bathrooms} banheiros`, x, startY + lineHeight);
    }

    currentY += lineHeight * 3;

    if (thumbnailData.area) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(`📐 ${thumbnailData.area} m²`, cardX + cardWidth / 2, currentY);
      currentY += lineHeight * 1.5;
    }

    // Localização
    if (thumbnailData.location) {
      currentY = cardY + cardHeight - cardHeight * 0.15;
      ctx.fillStyle = '#666666';
      ctx.font = `${fontSize * 0.9}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`📍 ${thumbnailData.location}`, cardX + cardWidth / 2, currentY);
    }
  };

  const renderFrame = (ctx: CanvasRenderingContext2D, time: number) => {
    const canvas = ctx.canvas;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Renderizar thumbnail se estiver habilitada e time < 1000ms
    if (thumbnailData.enabled && time < 1000) {
      renderThumbnail(ctx, canvas);
      return;
    }

    const videoClips = clips.filter(c => c.track.startsWith('V')).sort((a, b) => a.start - b.start);
    
    const currentClip = videoClips.find(
      c => c.start <= time && c.start + c.duration > time
    );

    if (!currentClip) return;

    // Verificar se o track está oculto
    const trackState = trackStates.find(t => t.name === currentClip.track);
    if (trackState?.hidden) return;

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

  const clearCache = () => {
    imageCacheRef.current.clear();
    currentAudioClipRef.current = null;
    stopAudio();
    stopSpeech();
    forceRerender(prev => prev + 1);
  };

  return (
    <section className="flex-1 bg-black flex items-center justify-center relative">
      <div className="absolute top-4 right-4 z-10 flex gap-2 items-center bg-black/70 px-3 py-2 rounded-lg backdrop-blur-sm">
        <Button
          size="sm"
          variant="ghost"
          onClick={clearCache}
          className="h-8 px-2 text-white hover:bg-white/20 text-xs"
          title="Limpar cache e re-renderizar"
        >
          Limpar Cache
        </Button>
        <div className="border-l border-white/20 pl-2">
          <span className="text-white text-sm font-semibold">{globalSettings.videoFormat}</span>
        </div>
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
