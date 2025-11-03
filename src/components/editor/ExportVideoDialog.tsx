import { useState } from "react";
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

  const hasClips = clips.some(c => c.type === 'image' || c.type === 'video');

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

      // Capturar stream do canvas
      const stream = exportCanvas.captureStream(fps);
      
      // Configurar MediaRecorder
      const candidateTypes = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
      const supported = (window as any).MediaRecorder?.isTypeSupported?.bind(window.MediaRecorder);
      const mimeType = supported ? candidateTypes.find(t => supported(t)) || 'video/webm' : 'video/webm';
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000
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
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size < 1024) {
            toast.error("Arquivo de vídeo vazio");
            setIsExporting(false);
            resolve();
            return;
          }
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_${globalSettings.videoFormat}_${dimensions.width}x${dimensions.height}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          
          toast.success("Vídeo exportado com sucesso!");
          setIsExporting(false);
          setExportProgress(100);
          setTimeout(() => setIsOpen(false), 1500);
          resolve();
        };
      });

      // Iniciar gravação
      mediaRecorder.start();
      
      // Renderizar frames usando setInterval (como no código de referência)
      const frameIntervalMs = 1000 / fps;
      const startTimestamp = performance.now();
      let frameCount = 0;

      await new Promise<void>((resolve) => {
        const recordingLoop = setInterval(() => {
          const virtualTimestamp = performance.now() - startTimestamp;
          
          // Renderizar frame
          renderFrame(ctx, virtualTimestamp, exportCanvas);
          
          // Atualizar progresso
          const progress = Math.min(100, (virtualTimestamp / durationMs) * 100);
          setExportProgress(Math.round(progress));
          frameCount++;
          
          // Verificar se concluiu
          if (virtualTimestamp >= durationMs) {
            clearInterval(recordingLoop);
            
            // Pequeno delay para garantir captura do último frame
            setTimeout(() => {
              mediaRecorder.stop();
              stream.getTracks().forEach(t => t.stop());
              resolve();
            }, 200);
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
                <span>Renderizando vídeo...</span>
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
