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
  const { clips, mediaItems, globalSettings, totalDuration, projectName } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const hasClips = clips.some(c => c.type === 'image' || c.type === 'video');

  const getVideoDimensions = () => {
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
        const img = new Image();
        // Tentar evitar canvas "tainted" quando possível
        img.crossOrigin = 'anonymous';
        const src = item.data;
        const load = () => new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Falha ao carregar imagem para exportação'));
          img.src = src;
        });
        try {
          const loaded = await load();
          drawableCache.set(mediaId, loaded);
          return loaded;
        } catch {
          // Tentativa sem crossOrigin como fallback
          const fallback = new Image();
          const load2 = () => new Promise<HTMLImageElement>((resolve, reject) => {
            fallback.onload = () => resolve(fallback);
            fallback.onerror = () => reject(new Error('Falha ao carregar imagem'));
            fallback.src = src;
          });
          try {
            const loaded2 = await load2();
            drawableCache.set(mediaId, loaded2);
            return loaded2;
          } catch {
            return null;
          }
        }
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
      const canvas = document.createElement('canvas');
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível criar contexto do canvas');

      const fps = Math.min(60, Math.max(1, Number(globalSettings.videoFPS) || 30));
      const frameInterval = 1000 / fps;
      // Garante duração mínima para melhor compatibilidade de players (e evitar arquivo vazio)
      const durationMs = Math.max(totalDuration, 2000);
      const totalFrames = Math.max(1, Math.ceil(durationMs / frameInterval));

      // Precarregar todas as mídias necessárias para exportação
      const videoClips = clips.filter(c => c.track.startsWith('V'));
      const uniqueMediaIds = Array.from(new Set(videoClips.map(c => c.mediaId)));
      await Promise.all(uniqueMediaIds.map(id => loadDrawable(id)));

      const stream = canvas.captureStream(fps);
      // Seleciona o MIME mais compatível disponível (prioriza VP8)
      const candidateTypes = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
      const supported = (window as any).MediaRecorder?.isTypeSupported?.bind(window.MediaRecorder);
      const mimeType = supported ? candidateTypes.find(t => supported(t)) || '' : '';
      const options: MediaRecorderOptions = mimeType
        ? { mimeType, videoBitsPerSecond: 5_000_000 }
        : { videoBitsPerSecond: 5_000_000 };
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.onerror = (e: any) => {
        console.error('MediaRecorder error:', e);
        toast.error("Falha ao gravar vídeo (MediaRecorder).");
      };

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => {
          try {
            const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
            if (!blob || blob.size < 1024) {
              console.error('Blob de vídeo vazio ou muito pequeno:', { size: blob?.size, chunks: chunks.length });
              toast.error("Falha ao exportar: arquivo de vídeo ficou vazio.");
              setIsExporting(false);
              resolve();
              return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_${globalSettings.videoFormat}.webm`;
            a.click();
            URL.revokeObjectURL(url);
            setIsExporting(false);
            setExportProgress(100);
            toast.success("Vídeo exportado com sucesso!");
            setTimeout(() => setIsOpen(false), 1500);
            resolve();
          } catch (err) {
            console.error('Erro ao finalizar exportação:', err);
            toast.error("Erro ao finalizar exportação");
            setIsExporting(false);
            resolve();
          }
        };
      });

      mediaRecorder.start(1000);

      const videoTrack = stream.getVideoTracks()[0];

      await new Promise<void>((resolve) => {
        let frame = 0;
        const frameIntervalMs = frameInterval;
        const timerId = setInterval(async () => {
          try {
            const time = frame * frameIntervalMs;
            await renderFrame(ctx, time, canvas);
            (videoTrack as any)?.requestFrame?.();
            frame++;
            setExportProgress(Math.min(100, Math.round((frame / totalFrames) * 100)));
            if (frame >= totalFrames) {
              clearInterval(timerId);
              setTimeout(() => {
                mediaRecorder.requestData?.();
                mediaRecorder.stop();
                resolve();
              }, 120);
            }
          } catch (e) {
            console.error('Erro ao renderizar frame:', e);
            clearInterval(timerId);
            try { mediaRecorder.stop(); } catch {}
            resolve();
          }
        }, frameIntervalMs);
      });

      await stopped;
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
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
