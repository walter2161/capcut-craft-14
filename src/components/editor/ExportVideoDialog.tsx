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
  const { clips, mediaItems, globalSettings, totalDuration, projectName, setCurrentTime, setIsPlaying, isPlaying, currentTime } = useEditorStore();
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

  const renderFrame = async (ctx: CanvasRenderingContext2D, time: number, canvas: HTMLCanvasElement) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const videoClips = clips.filter(c => c.track.startsWith('V')).sort((a, b) => a.start - b.start);
    const currentClip = videoClips.find(c => c.start <= time && c.start + c.duration > time);
    if (!currentClip) return;

    const media = await loadDrawable(currentClip.mediaId);
    if (!media) return;

    const timeInClip = time - currentClip.start;
    const transitionDuration = currentClip.transitionDuration || 500;

    // Desenhar próximo clipe ao fundo para cross-fade
    const currentIndex = videoClips.indexOf(currentClip);
    const nextClip = currentIndex < videoClips.length - 1 ? videoClips[currentIndex + 1] : null;
    let alpha = currentClip.opacity;
    if (nextClip && (currentClip.transition === 'cross-fade' || !currentClip.transition)) {
      const transitionStart = currentClip.duration - transitionDuration;
      if (timeInClip >= transitionStart) {
        const transitionTime = timeInClip - transitionStart;
        const transitionProgress = Math.min(1, Math.max(0, transitionTime / transitionDuration));
        const nextMedia = await loadDrawable(nextClip.mediaId);
        if (nextMedia) {
          const nextProps = fitImageToCanvas(nextMedia, canvas);
          ctx.filter = 'none';
          ctx.globalAlpha = 1;
          const nextScaledW = nextProps.drawWidth * nextClip.scale;
          const nextScaledH = nextProps.drawHeight * nextClip.scale;
          const nextX = (canvas.width - nextScaledW) / 2;
          const nextY = (canvas.height - nextScaledH) / 2;
          ctx.drawImage(nextMedia as any, nextX, nextY, nextScaledW, nextScaledH);
        }
        alpha = (1 - transitionProgress) * currentClip.opacity;
      }
    }

    // Vídeo: sincronizar tempo antes de desenhar
    if (media instanceof HTMLVideoElement) {
      const videoTime = (timeInClip / 1000) * currentClip.speed;
      if (Math.abs(media.currentTime - videoTime) > 0.05) {
        await seekVideo(media, Math.max(0, Math.min(videoTime, media.duration || 0)));
      }
      if (media.readyState < 2) return;
    }

    const props = fitImageToCanvas(media, canvas);
    ctx.filter = `brightness(${100 + currentClip.brightness}%) contrast(${100 + currentClip.contrast}%)`;
    ctx.globalAlpha = alpha;
    const scaledW = props.drawWidth * currentClip.scale;
    const scaledH = props.drawHeight * currentClip.scale;
    const x = (canvas.width - scaledW) / 2;
    const y = (canvas.height - scaledH) / 2;
    ctx.drawImage(media as any, x, y, scaledW, scaledH);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    // Renderizar legendas
    const subtitleClips = clips.filter(c => c.type === 'subtitle');
    const currentSubtitle = subtitleClips.find(
      c => c.start <= time && c.start + c.duration > time
    );

    if (currentSubtitle && currentSubtitle.text) {
      // Configurar estilo do texto
      const fontSize = Math.floor(canvas.height * 0.04); // 4% da altura do canvas
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      const text = currentSubtitle.text;
      const maxWidth = canvas.width * 0.9;
      const lineHeight = fontSize * 1.2;
      
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
      
      // Desenhar fundo semi-transparente
      const padding = fontSize * 0.6;
      const totalHeight = lines.length * lineHeight + padding * 2;
      const bgY = canvas.height - fontSize * 2 - totalHeight;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, bgY, canvas.width, totalHeight);
      
      // Desenhar texto com contorno
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.lineWidth = fontSize * 0.15;
      ctx.fillStyle = '#FFFFFF';
      
      lines.forEach((line, index) => {
        const textY = bgY + padding + (index + 1) * lineHeight;
        ctx.strokeText(line, canvas.width / 2, textY);
        ctx.fillText(line, canvas.width / 2, textY);
      });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const dimensions = getVideoDimensions();
      const fps = Math.min(60, Math.max(1, Number(globalSettings.videoFPS) || 30));
      const durationMs = Math.max(totalDuration, 2000);

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

      // Criar AudioContext para capturar áudio
      const audioContext = new AudioContext({ sampleRate: 48000 });
      await audioContext.resume();
      const audioDestination = audioContext.createMediaStreamDestination();

      // Preparar clips de áudio
      const audioClips = clips.filter(c => c.type === 'audio').sort((a, b) => a.start - b.start);
      
      // Preparar sintetizador de voz para legendas
      const subtitleClips = clips.filter(c => c.type === 'subtitle').sort((a, b) => a.start - b.start);
      const audioBuffers: { start: number; buffer: AudioBuffer; duration: number; volume: number; speed: number }[] = [];

      // Adicionar buffers de áudio dos clips de áudio
      for (const audioClip of audioClips) {
        const mediaItem = mediaItems.find(m => m.id === audioClip.mediaId);
        if (mediaItem && mediaItem.data instanceof AudioBuffer) {
          audioBuffers.push({
            start: audioClip.start / 1000,
            buffer: mediaItem.data,
            duration: audioClip.duration / 1000,
            volume: audioClip.volume,
            speed: audioClip.speed
          });
        }
      }

      // Gerar áudio para cada legenda
      for (const subtitle of subtitleClips) {
        if (!subtitle.text) continue;
        
        try {
          const utterance = new SpeechSynthesisUtterance(subtitle.text);
          utterance.lang = 'pt-BR';
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          // Usar Web Speech API para gerar o áudio
          await new Promise<void>((resolve) => {
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
          });

          // Calcular a duração estimada do áudio baseado no texto
          const words = subtitle.text.split(/\s+/).length;
          const estimatedDuration = (words / 150) * 60; // 150 palavras por minuto
          const buffer = audioContext.createBuffer(
            2, 
            Math.ceil(estimatedDuration * audioContext.sampleRate),
            audioContext.sampleRate
          );

          audioBuffers.push({
            start: subtitle.start / 1000,
            buffer,
            duration: estimatedDuration,
            volume: subtitle.volume || 1.0,
            speed: 1.0
          });
        } catch (error) {
          console.warn('Erro ao gerar áudio da legenda:', error);
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
        audioBitsPerSecond: 128_000
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
              '-b:a', '192k',
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
      audioBuffers.forEach(({ start, buffer, duration, volume, speed }) => {
        try {
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = speed;

          const gainNode = audioContext.createGain();
          gainNode.gain.value = volume;

          source.connect(gainNode);
          gainNode.connect(audioDestination);

          const when = baseTime + Math.max(0, start);
          const maxDur = Math.max(0, Math.min(buffer.duration / speed, duration / speed));
          source.start(when, 0, maxDur);
          scheduledSources.push(source);
        } catch (e) {
          console.error('Agendamento de áudio falhou:', e);
        }
      });
      
      // Renderizar frames
      const frameIntervalMs = 1000 / fps;
      const startTimestamp = performance.now();
      let frameCount = 0;
      const playedAudios = new Set<string>();

      await new Promise<void>((resolve) => {
        const recordingLoop = setInterval(() => {
          const virtualTimestamp = performance.now() - startTimestamp;
          const currentTimeSeconds = virtualTimestamp / 1000;
          
          // Áudio já pré-agendado acima
          // Renderizar frame
          renderFrame(ctx, virtualTimestamp, exportCanvas);
          
          // Atualizar progresso
          const progress = Math.min(100, (virtualTimestamp / durationMs) * 100);
          setExportProgress(Math.round(progress));
          frameCount++;
          
          // Verificar se concluiu
          if (virtualTimestamp >= durationMs) {
            clearInterval(recordingLoop);
            
            // Pequeno delay para garantir captura do último frame e áudio
            setTimeout(() => {
              mediaRecorder.stop();
              combinedStream.getTracks().forEach(t => t.stop());
              audioContext.close();
              resolve();
            }, 500);
          }
        }, frameIntervalMs);
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
