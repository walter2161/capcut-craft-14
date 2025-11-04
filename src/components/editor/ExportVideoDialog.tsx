import { useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { Download, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useEditorStore } from "@/store/editorStore";
import { toast } from "sonner";

export const ExportVideoDialog = () => {
  const { clips, mediaItems, globalSettings, totalDuration, projectName, setCurrentTime, setIsPlaying, isPlaying, currentTime, trackStates, thumbnailData } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const hasClips = clips.length > 0;

  const getVideoDimensions = () => {
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

  // Cache de mídias preparadas para exportação
  const drawableCache = new Map<string, HTMLImageElement | HTMLVideoElement>();

  const fitImageToCanvas = (media: any, canvas: HTMLCanvasElement) => {
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

  const renderThumbnail = async (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Pegar a primeira imagem dos clips
    const firstImageClip = clips.find(c => c.type === 'image' && c.track.startsWith('V'));
    if (!firstImageClip) return;

    const media = await loadDrawable(firstImageClip.mediaId);
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

  const loadDrawable = async (mediaId: string) => {
    if (drawableCache.has(mediaId)) return drawableCache.get(mediaId)!;
    const item = mediaItems.find(m => m.id === mediaId);
    if (!item) return null;

    if (item.type === 'image') {
      if (item.data instanceof HTMLImageElement) {
        drawableCache.set(mediaId, item.data);
        return item.data;
      }
      if (typeof item.data === 'string') {
        const src = item.data as string;

        const loadWith = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Falha ao carregar imagem para exportação'));
          img.src = url;
        });

        const buildWeserv = (u: string) => {
          try {
            const stripped = u.replace(/^https?:\/\//, '');
            return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}`;
          } catch {
            return '';
          }
        };

        const proxyCandidates = [
          src,
          buildWeserv(src),
          `https://cors.isomorphic-git.org/${src}`,
        ].filter(Boolean) as string[];

        for (const candidate of proxyCandidates) {
          try {
            const loaded = await loadWith(candidate);
            drawableCache.set(mediaId, loaded);
            return loaded;
          } catch {
            // tenta próximo candidato
          }
        }
        // Se todas as tentativas falharem, retorna null para evitar "taint" no canvas
        return null;
      }
      return null;
    }

    if (item.type === 'video') {
      if (item.data instanceof HTMLVideoElement) {
        // Garantir metadados carregados
        const video = item.data as HTMLVideoElement;
        if (video.readyState < 1) {
          await new Promise<void>((resolve) => {
            video.addEventListener('loadedmetadata', () => resolve(), { once: true });
          });
        }
        drawableCache.set(mediaId, video);
        return video;
      }
    }

    return null;
  };

  const seekVideo = (video: HTMLVideoElement, time: number) => {
    return new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  };

  // Função de easing para transições suaves
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const renderFrame = async (ctx: CanvasRenderingContext2D, time: number, canvas: HTMLCanvasElement) => {
    // Limpar canvas completamente
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Renderizar thumbnail se estiver habilitada e time < 1000ms
    if (thumbnailData.enabled && time < 1000) {
      await renderThumbnail(ctx, canvas);
      return;
    }

    // Ajustar tempo se thumbnail estiver habilitada (subtrair 1 segundo)
    const adjustedTime = thumbnailData.enabled ? time - 1000 : time;

    const videoClips = clips.filter(c => c.track.startsWith('V')).sort((a, b) => a.start - b.start);
    const currentClip = videoClips.find(c => c.start <= adjustedTime && c.start + c.duration > adjustedTime);
    if (!currentClip) return;

    // Verificar se o track está oculto
    const trackState = trackStates.find(t => t.name === currentClip.track);
    if (trackState?.hidden) return;

    const media = await loadDrawable(currentClip.mediaId);
    if (!media) return;

    const timeInClip = adjustedTime - currentClip.start;
    const transitionDuration = currentClip.transitionDuration || 500;

    // Vídeo: sincronizar tempo antes de desenhar
    if (media instanceof HTMLVideoElement) {
      const videoTime = (timeInClip / 1000) * currentClip.speed;
      if (Math.abs(media.currentTime - videoTime) > 0.1) {
        await seekVideo(media, Math.max(0, Math.min(videoTime, media.duration || 0)));
      }
      // Aguardar um frame adicional para garantir que o vídeo está pronto
      if (media.readyState < 2) {
        await new Promise(resolve => setTimeout(resolve, 16));
      }
      if (media.readyState < 2) return;
    }

    // Calcular transição
    const currentIndex = videoClips.indexOf(currentClip);
    const nextClip = currentIndex < videoClips.length - 1 ? videoClips[currentIndex + 1] : null;
    let currentAlpha = currentClip.opacity;
    let nextAlpha = 0;
    let shouldDrawNext = false;

    if (nextClip && (currentClip.transition === 'cross-fade' || !currentClip.transition)) {
      const transitionStart = currentClip.duration - transitionDuration;
      if (timeInClip >= transitionStart) {
        const transitionTime = timeInClip - transitionStart;
        const rawProgress = Math.min(1, Math.max(0, transitionTime / transitionDuration));
        const transitionProgress = easeInOutCubic(rawProgress);
        
        currentAlpha = (1 - transitionProgress) * currentClip.opacity;
        nextAlpha = transitionProgress;
        shouldDrawNext = true;
      }
    }

    // Reset de estados do contexto
    ctx.save();

    // Desenhar próximo clipe ao fundo (se em transição)
    if (shouldDrawNext && nextClip) {
      const nextMedia = await loadDrawable(nextClip.mediaId);
      if (nextMedia) {
        // Sincronizar vídeo do próximo clipe se necessário
        if (nextMedia instanceof HTMLVideoElement) {
          const nextVideoTime = 0; // Começa do início do próximo clipe
          if (Math.abs(nextMedia.currentTime - nextVideoTime) > 0.1) {
            await seekVideo(nextMedia, nextVideoTime);
          }
          if (nextMedia.readyState >= 2) {
            const nextProps = fitImageToCanvas(nextMedia, canvas);
            ctx.globalAlpha = nextAlpha;
            ctx.filter = `brightness(${100 + nextClip.brightness}%) contrast(${100 + nextClip.contrast}%)`;
            const nextScaledW = nextProps.drawWidth * nextClip.scale;
            const nextScaledH = nextProps.drawHeight * nextClip.scale;
            const nextX = (canvas.width - nextScaledW) / 2;
            const nextY = (canvas.height - nextScaledH) / 2;
            ctx.drawImage(nextMedia, nextX, nextY, nextScaledW, nextScaledH);
          }
        } else {
          // Imagem
          const nextProps = fitImageToCanvas(nextMedia, canvas);
          ctx.globalAlpha = nextAlpha;
          ctx.filter = `brightness(${100 + nextClip.brightness}%) contrast(${100 + nextClip.contrast}%)`;
          const nextScaledW = nextProps.drawWidth * nextClip.scale;
          const nextScaledH = nextProps.drawHeight * nextClip.scale;
          const nextX = (canvas.width - nextScaledW) / 2;
          const nextY = (canvas.height - nextScaledH) / 2;
          ctx.drawImage(nextMedia, nextX, nextY, nextScaledW, nextScaledH);
        }
      }
    }

    // Desenhar clipe atual por cima
    const props = fitImageToCanvas(media, canvas);
    ctx.globalAlpha = currentAlpha;
    ctx.filter = `brightness(${100 + currentClip.brightness}%) contrast(${100 + currentClip.contrast}%)`;
    const scaledW = props.drawWidth * currentClip.scale;
    const scaledH = props.drawHeight * currentClip.scale;
    const x = (canvas.width - scaledW) / 2;
    const y = (canvas.height - scaledH) / 2;
    ctx.drawImage(media, x, y, scaledW, scaledH);

    ctx.restore();

    // Renderizar legendas (respeitando hidden)
    const subtitleClips = clips.filter(c => c.type === 'subtitle');
    const currentSubtitle = subtitleClips.find(
      c => c.start <= adjustedTime && c.start + c.duration > adjustedTime
    );

    if (currentSubtitle && currentSubtitle.text) {
      const trackState = trackStates.find(t => t.name === currentSubtitle.track);
      if (!trackState?.hidden) {
        // Configurar estilo do texto - Montserrat, text-lg, com sombra
        const fontSize = Math.floor(canvas.height * 0.022); // ~text-lg (aproximadamente)
        ctx.font = `600 ${fontSize}px Montserrat, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        // Configurar sombra
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
      
        const text = currentSubtitle.text;
        const maxWidth = canvas.width * 0.9;
        const lineHeight = fontSize * 1.5;
        
        // Quebrar texto em múltiplas linhas se necessário
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        if (currentLine) lines.push(currentLine);
        
        // Desenhar texto branco com sombra (sem fundo)
        ctx.fillStyle = '#FFFFFF';
        
        // Calcular posição: 100px do rodapé
        const subtitleBottomMargin = 100;
        const totalHeight = lines.length * lineHeight;
        const startY = canvas.height - subtitleBottomMargin - totalHeight + lineHeight;
        
        lines.forEach((line, index) => {
          const textY = startY + (index * lineHeight);
          ctx.fillText(line, canvas.width / 2, textY);
        });
        
        // Resetar sombra
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const dimensions = getVideoDimensions();
      const fps = Math.min(60, Math.max(1, Number(globalSettings.videoFPS) || 30));
      // Adicionar 1 segundo se thumbnail estiver habilitada
      const baseDuration = Math.max(totalDuration, 2000);
      const durationMs = thumbnailData.enabled ? baseDuration + 1000 : baseDuration;

      // Criar canvas dedicado para exportação
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = dimensions.width;
      exportCanvas.height = dimensions.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível criar contexto do canvas');

      // Frame inicial
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // Precarregar mídias
      const videoClips = clips.filter(c => c.track.startsWith('V'));
      const uniqueMediaIds = Array.from(new Set(videoClips.map(c => c.mediaId)));
      const preloadResults = await Promise.all(uniqueMediaIds.map(id => loadDrawable(id)));
      const failed = preloadResults.filter(r => !r).length;
      if (failed > 0) {
        toast.warning(`Algumas mídias não puderam ser preparadas (CORS): ${failed}`);
      }

      // Criar AudioContext para capturar áudio com alta qualidade
      const audioContext = new AudioContext({ sampleRate: 48000 });
      await audioContext.resume();
      const audioDestination = audioContext.createMediaStreamDestination();

      // Preparar clips de áudio
      const audioClips = clips.filter(c => c.type === 'audio').sort((a, b) => a.start - b.start);
      
      // Preparar sintetizador de voz para legendas
      const subtitleClips = clips.filter(c => c.type === 'subtitle').sort((a, b) => a.start - b.start);
      const audioBuffers: { start: number; buffer: AudioBuffer; duration: number; volume: number; speed: number; trimStart: number }[] = [];

      // Adicionar buffers de áudio dos clips de áudio (respeitando mute)
      for (const audioClip of audioClips) {
        const trackState = trackStates.find(t => t.name === audioClip.track);
        if (trackState?.muted) continue; // Pular se estiver mutado
        
        const mediaItem = mediaItems.find(m => m.id === audioClip.mediaId);
        if (mediaItem && mediaItem.data instanceof AudioBuffer) {
          // Ajustar start time se thumbnail estiver habilitada
          const adjustedStart = thumbnailData.enabled ? (audioClip.start / 1000) + 1 : audioClip.start / 1000;
          audioBuffers.push({
            start: adjustedStart,
            buffer: mediaItem.data,
            duration: audioClip.duration / 1000,
            volume: audioClip.volume,
            speed: audioClip.speed,
            trimStart: (audioClip.trimStart || 0) / 1000 // Converter para segundos
          });
        }
      }

      const videoStream = exportCanvas.captureStream(fps);
      
      // Debug: verificar trilhas de áudio
      console.log('Audio buffers para exportar:', audioBuffers.length);
      
      // Combinar streams de vídeo e áudio
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);
      console.log('Trilhas combinadas - vídeo:', videoStream.getVideoTracks().length, 'áudio:', audioDestination.stream.getAudioTracks().length);
      
      // Configurar MediaRecorder com áudio e vídeo
      const candidateTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      const isSupported = (type: string) => {
        const MR = (window as any).MediaRecorder;
        return MR && typeof MR.isTypeSupported === 'function' ? MR.isTypeSupported(type) : false;
      };
      const mimeType = candidateTypes.find(isSupported) || 'video/webm';
      
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
        audioBitsPerSecond: 320_000 // Alta qualidade de áudio
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onerror = (e: any) => {
        console.error('MediaRecorder error:', e);
        toast.error("Falha ao gravar vídeo");
      };

      const stopped = new Promise<void>((resolve) => {
        mediaRecorder.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size < 1024) {
              toast.error("Arquivo de vídeo vazio");
              setIsExporting(false);
              resolve();
              return;
            }

            // Se o navegador suportar MP4 nativamente, baixar direto
            if (mimeType.includes('mp4')) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_${globalSettings.videoFormat}_${dimensions.width}x${dimensions.height}.mp4`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Vídeo exportado em MP4 com sucesso!");
              setIsExporting(false);
              setExportProgress(100);
              setTimeout(() => setIsOpen(false), 1500);
              resolve();
              return;
            }

            // Transcodificar para MP4 (H.264 + AAC)
            setExportProgress((p) => Math.min(95, p));
            toast.message("Convertendo para MP4... isso pode levar alguns minutos");

            const ffmpeg = new FFmpeg();

            // Tentar múltiplos CDNs para carregar o core do FFmpeg
            const bases = [
              'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.2/dist/ffmpeg-core',
              'https://unpkg.com/@ffmpeg/core@0.12.2/dist/ffmpeg-core'
            ];
            let loaded = false;
            for (const base of bases) {
              try {
                await ffmpeg.load({
                  coreURL: await toBlobURL(`${base}.js`, 'text/javascript'),
                  wasmURL: await toBlobURL(`${base}.wasm`, 'application/wasm'),
                  workerURL: await toBlobURL(`${base}.worker.js`, 'text/javascript'),
                });
                loaded = true;
                break;
              } catch (e) {
                console.warn('Falha ao carregar FFmpeg de', base, e);
              }
            }
            if (!loaded) throw new Error('Não foi possível carregar o FFmpeg');

            const inputName = 'input.webm';
            const outputName = 'output.mp4';
            await ffmpeg.writeFile(inputName, await fetchFile(blob));

            await ffmpeg.exec([
              '-i', inputName,
              '-c:v', 'libx264',
              '-preset', 'veryfast',
              '-crf', '23',
              '-c:a', 'aac',
              '-b:a', '320k', // Alta qualidade de áudio
              '-ar', '48000', // Sample rate de 48kHz
              outputName
            ]);

            const data = await ffmpeg.readFile(outputName);
            const mp4Blob = new Blob([new Uint8Array(data as any)], { type: 'video/mp4' });
            const url = URL.createObjectURL(mp4Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_${globalSettings.videoFormat}_${dimensions.width}x${dimensions.height}.mp4`;
            a.click();
            URL.revokeObjectURL(url);

            toast.success("Vídeo exportado em MP4 com sucesso!");
            setIsExporting(false);
            setExportProgress(100);
            setTimeout(() => setIsOpen(false), 1500);
            resolve();
          } catch (err) {
            console.error('Falha na conversão para MP4, baixando WEBM como fallback', err);
            // Fallback: baixar WEBM
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_${globalSettings.videoFormat}_${dimensions.width}x${dimensions.height}.webm`;
            a.click();
            URL.revokeObjectURL(url);
            toast.warning("MP4 indisponível, WEBM exportado como alternativa");
            setIsExporting(false);
            setExportProgress(100);
            setTimeout(() => setIsOpen(false), 1500);
            resolve();
          }
        };
      });

      // Iniciar gravação
      mediaRecorder.start();
      
      // Pré-agendar fontes de áudio para o MediaStreamDestination
      const scheduledSources: AudioBufferSourceNode[] = [];
      const baseTime = audioContext.currentTime;
      audioBuffers.forEach(({ start, buffer, duration, volume, speed, trimStart }) => {
        try {
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = speed;

          const gainNode = audioContext.createGain();
          gainNode.gain.value = volume;

          source.connect(gainNode);
          gainNode.connect(audioDestination);

          const when = baseTime + Math.max(0, start);
          // Usar trimStart para começar do ponto correto no buffer
          const offset = Math.max(0, trimStart);
          const maxDur = Math.max(0, Math.min((buffer.duration - offset) / speed, duration / speed));
          source.start(when, offset, maxDur);
          scheduledSources.push(source);
        } catch (e) {
          console.error('Agendamento de áudio falhou:', e);
        }
      });
      
      // Renderizar frames com timing preciso
      const frameIntervalMs = 1000 / fps;
      const startTimestamp = performance.now();
      let frameCount = 0;
      const totalFrames = Math.ceil((durationMs / 1000) * fps);

      await new Promise<void>((resolve) => {
        const renderNextFrame = async () => {
          const virtualTimestamp = frameCount * frameIntervalMs;
          
          if (virtualTimestamp >= durationMs || frameCount >= totalFrames) {
            // Pequeno delay para garantir captura do último frame e áudio
            setTimeout(() => {
              mediaRecorder.stop();
              combinedStream.getTracks().forEach(t => t.stop());
              audioContext.close();
              resolve();
            }, 300);
            return;
          }
          
          try {
            // Renderizar frame de forma assíncrona
            await renderFrame(ctx, virtualTimestamp, exportCanvas);
            
            // Atualizar progresso
            const progress = Math.min(95, (frameCount / totalFrames) * 95);
            setExportProgress(Math.round(progress));
            frameCount++;
            
            // Calcular timing para próximo frame
            const elapsedTime = performance.now() - startTimestamp;
            const expectedTime = frameCount * frameIntervalMs;
            const drift = expectedTime - elapsedTime;
            
            // Compensar drift com delay ajustado
            const delay = Math.max(0, frameIntervalMs + drift);
            
            setTimeout(() => {
              requestAnimationFrame(renderNextFrame);
            }, delay);
          } catch (error) {
            console.error('Erro ao renderizar frame:', error);
            setTimeout(() => {
              mediaRecorder.stop();
              combinedStream.getTracks().forEach(t => t.stop());
              audioContext.close();
              resolve();
            }, 100);
          }
        };
        
        // Iniciar renderização após um pequeno delay
        setTimeout(() => {
          requestAnimationFrame(renderNextFrame);
        }, 100);
      });

      await stopped;

    } catch (error) {
      console.error('Erro ao exportar vídeo:', error);
      toast.error("Erro ao exportar vídeo");
      setIsExporting(false);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          disabled={!hasClips}
          className="bg-primary hover:bg-primary/90"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar Vídeo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Exportar Vídeo
          </DialogTitle>
          <DialogDescription>
            Confira as informações do vídeo antes de exportar
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Formato</p>
              <p className="font-semibold">{globalSettings.videoFormat}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Resolução</p>
              <p className="font-semibold">
                {getVideoDimensions().width} x {getVideoDimensions().height}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">FPS</p>
              <p className="font-semibold">{globalSettings.videoFPS}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Duração</p>
              <p className="font-semibold">{formatDuration(totalDuration)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Clipes</p>
              <p className="font-semibold">{clips.length} clipes na timeline</p>
            </div>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Renderizando vídeo e convertendo para MP4...</span>
                <span>{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isExporting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? "Exportando..." : "Exportar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
