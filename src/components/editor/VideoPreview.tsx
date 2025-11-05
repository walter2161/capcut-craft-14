import { useRef, useEffect, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";

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

    // Verificar se o track está oculto
    const trackState = trackStates.find(t => t.name === currentClip?.track);
    const isHidden = trackState?.hidden || false;

    if (currentClip && currentClip.text && !isHidden) {
      setCurrentSubtitle(currentClip.text);
    } else {
      setCurrentSubtitle('');
    }
  };

  const fitImageToCanvas = (media: any, canvas: HTMLCanvasElement, progress: number = 0, duration: number = 0) => {
    // Support Image, HTMLVideoElement, and CanvasImageSource
    const srcWidth = media?.videoWidth || media?.naturalWidth || media?.width || 0;
    const srcHeight = media?.videoHeight || media?.naturalHeight || media?.height || 0;

    if (!srcWidth || !srcHeight) {
      return { drawWidth: canvas.width, drawHeight: canvas.height, offsetX: 0, offsetY: 0, panOffsetX: 0, scale: 1 };
    }

    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = srcWidth / srcHeight;
    const fitMode = globalSettings?.mediaFitMode || 'fit-height';
    const isHorizontalImage = imgRatio > 1;
    const isVerticalVideo = globalSettings.videoFormat === '9:16';
    
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

    // Apply pan effect for horizontal images in vertical video
    let panOffsetX = 0;
    if (globalSettings.enablePanEffect && isHorizontalImage && isVerticalVideo && duration > 0) {
      const maxPan = (drawWidth - canvas.width) * 0.3; // Pan 30% of overflow
      panOffsetX = -maxPan * Math.sin(progress * Math.PI); // Smooth pan left-right
    }

    // Apply zoom effect
    let scale = 1;
    if (globalSettings.enableZoomEffect && duration > 0) {
      const zoomAmount = 0.1; // 10% zoom
      scale = 1 + (zoomAmount * progress); // Zoom from 1.0 to 1.1
    }
    
    return { drawWidth, drawHeight, offsetX, offsetY, panOffsetX, scale };
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

    // Gradient overlay (escuro embaixo, transparente em cima)
    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${thumbnailData.overlayOpacity * 0.55})`);
    gradient.addColorStop(0.5, `rgba(0, 0, 0, ${thumbnailData.overlayOpacity * 0.15})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Área 1x1 centralizada (65% de largura)
    const squareSize = Math.min(canvas.width, canvas.height);
    const areaWidth = squareSize * 0.65;
    const areaHeight = areaWidth;
    const areaX = (canvas.width - areaWidth) / 2;
    const areaY = (canvas.height - areaHeight) / 2;
    
    const padding = areaWidth * 0.05;
    const contentX = areaX + padding;
    const contentY = areaY + areaHeight - padding;
    const contentWidth = areaWidth - (padding * 2);

    // Configurar text shadow para todos os textos
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    const baseFontSize = areaWidth * 0.055;
    const lineHeight = baseFontSize * 1.2;
    let currentY = contentY;

    // Detalhes (de baixo para cima)
    ctx.font = `600 ${baseFontSize * thumbnailData.textFontSize}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';

    // Área
    if (thumbnailData.area) {
      ctx.fillStyle = thumbnailData.textColor;
      ctx.fillText(`📐 ${thumbnailData.area}m² Área Útil`, contentX + contentWidth / 2, currentY);
      currentY -= lineHeight * 1.3;
    }

    // Banheiros
    if (thumbnailData.bathrooms) {
      ctx.fillStyle = thumbnailData.textColor;
      ctx.fillText(`🚿 ${thumbnailData.bathrooms} Banheiro${thumbnailData.bathrooms !== '1' ? 's' : ''}`, contentX + contentWidth / 2, currentY);
      currentY -= lineHeight * 1.3;
    }

    // Quartos
    if (thumbnailData.bedrooms) {
      ctx.fillStyle = thumbnailData.textColor;
      ctx.fillText(`🛏️ ${thumbnailData.bedrooms} Quarto${thumbnailData.bedrooms !== '1' ? 's' : ''}`, contentX + contentWidth / 2, currentY);
      currentY -= lineHeight * 1.3;
    }

    // Localização
    if (thumbnailData.location) {
      ctx.fillStyle = thumbnailData.locationColor;
      ctx.fillText(`📍 ${thumbnailData.location}`, contentX + contentWidth / 2, currentY);
      currentY -= lineHeight * 1.8;
    }

    // Caixa de preço (background azul)
    if (thumbnailData.price) {
      const priceBoxHeight = baseFontSize * thumbnailData.priceFontSize * 2.2;
      const priceBoxY = currentY - priceBoxHeight;
      const priceBoxPadding = contentWidth * 0.08;
      
      // Desabilitar shadow para o box
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Box background
      ctx.fillStyle = thumbnailData.priceColor;
      const radius = 10;
      ctx.beginPath();
      ctx.moveTo(contentX + priceBoxPadding + radius, priceBoxY);
      ctx.lineTo(contentX + contentWidth - priceBoxPadding - radius, priceBoxY);
      ctx.quadraticCurveTo(contentX + contentWidth - priceBoxPadding, priceBoxY, contentX + contentWidth - priceBoxPadding, priceBoxY + radius);
      ctx.lineTo(contentX + contentWidth - priceBoxPadding, priceBoxY + priceBoxHeight - radius);
      ctx.quadraticCurveTo(contentX + contentWidth - priceBoxPadding, priceBoxY + priceBoxHeight, contentX + contentWidth - priceBoxPadding - radius, priceBoxY + priceBoxHeight);
      ctx.lineTo(contentX + priceBoxPadding + radius, priceBoxY + priceBoxHeight);
      ctx.quadraticCurveTo(contentX + priceBoxPadding, priceBoxY + priceBoxHeight, contentX + priceBoxPadding, priceBoxY + priceBoxHeight - radius);
      ctx.lineTo(contentX + priceBoxPadding, priceBoxY + radius);
      ctx.quadraticCurveTo(contentX + priceBoxPadding, priceBoxY, contentX + priceBoxPadding + radius, priceBoxY);
      ctx.closePath();
      ctx.fill();
      
      // Box shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 15;
      ctx.fill();
      
      // Reativar text shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      
      // Preço
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${baseFontSize * thumbnailData.priceFontSize * 1.1}px Inter, Arial, sans-serif`;
      ctx.fillText(thumbnailData.price, contentX + contentWidth / 2, priceBoxY + priceBoxHeight * 0.5);
      
      // Label do preço
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = `400 ${baseFontSize * thumbnailData.priceFontSize * 0.45}px Inter, Arial, sans-serif`;
      ctx.fillText('Oportunidade Única!', contentX + contentWidth / 2, priceBoxY + priceBoxHeight * 0.82);
      
      currentY = priceBoxY - lineHeight * 0.8;
    }

    // REF
    if (thumbnailData.referencia) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = `500 ${baseFontSize * thumbnailData.textFontSize * 0.95}px Inter, Arial, sans-serif`;
      ctx.fillText(`REF.: ${thumbnailData.referencia}`, contentX + contentWidth / 2, currentY);
      currentY -= lineHeight * 1.2;
    }

    // Título
    if (thumbnailData.title) {
      ctx.fillStyle = thumbnailData.titleColor;
      ctx.font = `700 ${baseFontSize * thumbnailData.titleFontSize * 1.1}px Inter, Arial, sans-serif`;
      const titleUpper = thumbnailData.title.toUpperCase();
      ctx.fillText(titleUpper, contentX + contentWidth / 2, currentY);
    }

    // Resetar shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
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
            const nextProgress = 0; // Próximo clip começa do início
            const nextDuration = nextClip.duration;
            const nextImgProps = fitImageToCanvas(nextMedia, canvas, nextProgress, nextDuration);
            
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            
            const nextScaledWidth = nextImgProps.drawWidth * nextClip.scale * nextImgProps.scale;
            const nextScaledHeight = nextImgProps.drawHeight * nextClip.scale * nextImgProps.scale;
            const nextOffsetX = (canvas.width - nextScaledWidth) / 2 + nextImgProps.panOffsetX;
            const nextOffsetY = (canvas.height - nextScaledHeight) / 2;
            
            ctx.save();
            if (nextImgProps.scale !== 1) {
              const centerX = nextOffsetX + nextScaledWidth / 2;
              const centerY = nextOffsetY + nextScaledHeight / 2;
              ctx.translate(centerX, centerY);
              ctx.scale(nextImgProps.scale, nextImgProps.scale);
              ctx.translate(-centerX, -centerY);
            }
            ctx.drawImage(nextMedia, nextOffsetX, nextOffsetY, nextScaledWidth / nextImgProps.scale, nextScaledHeight / nextImgProps.scale);
            ctx.restore();
          }
        }
        
        // Ajustar alpha da mídia atual para fade out
        alpha = (1 - transitionProgress) * currentClip.opacity;
      }
    }
    
    // Desenhar a mídia atual (imagem ou vídeo)
    const clipProgress = timeInClip / currentClip.duration;
    const imgProps = fitImageToCanvas(media, canvas, clipProgress, currentClip.duration);
    
    ctx.filter = `brightness(${100 + currentClip.brightness}%) contrast(${100 + currentClip.contrast}%)`;
    ctx.globalAlpha = alpha;

    const scaledWidth = imgProps.drawWidth * currentClip.scale * imgProps.scale;
    const scaledHeight = imgProps.drawHeight * currentClip.scale * imgProps.scale;
    const offsetX = (canvas.width - scaledWidth) / 2 + imgProps.panOffsetX;
    const offsetY = (canvas.height - scaledHeight) / 2;

    ctx.save();
    if (imgProps.scale !== 1) {
      const centerX = offsetX + scaledWidth / 2;
      const centerY = offsetY + scaledHeight / 2;
      ctx.translate(centerX, centerY);
      ctx.scale(imgProps.scale, imgProps.scale);
      ctx.translate(-centerX, -centerY);
    }
    ctx.drawImage(media, offsetX, offsetY, scaledWidth / imgProps.scale, scaledHeight / imgProps.scale);
    ctx.restore();
    
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
            <div className="absolute bottom-[100px] left-1/2 transform -translate-x-1/2 text-center max-w-[90%]">
              <p 
                className="text-lg font-semibold leading-relaxed text-white font-montserrat"
                style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
              >
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
