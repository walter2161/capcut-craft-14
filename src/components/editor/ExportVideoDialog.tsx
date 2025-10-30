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

  const renderFrame = (ctx: CanvasRenderingContext2D, time: number, canvas: HTMLCanvasElement) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const videoClips = clips.filter(c => c.track.startsWith('V')).sort((a, b) => a.start - b.start);
    const currentClip = videoClips.find(c => c.start <= time && c.start + c.duration > time);

    if (!currentClip) return;

    const mediaItem = mediaItems.find(m => m.id === currentClip.mediaId);
    if (!mediaItem || !mediaItem.data) return;

    const image = mediaItem.data;
    const imgRatio = image.width / image.height;
    const canvasRatio = canvas.width / canvas.height;

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

    ctx.filter = `brightness(${100 + currentClip.brightness}%) contrast(${100 + currentClip.contrast}%)`;
    ctx.globalAlpha = currentClip.opacity;

    const scaledWidth = drawWidth * currentClip.scale;
    const scaledHeight = drawHeight * currentClip.scale;
    const finalOffsetX = (canvas.width - scaledWidth) / 2;
    const finalOffsetY = (canvas.height - scaledHeight) / 2;

    ctx.drawImage(image, finalOffsetX, finalOffsetY, scaledWidth, scaledHeight);
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

      const fps = globalSettings.videoFPS;
      const frameInterval = 1000 / fps;
      const totalFrames = Math.ceil(totalDuration / frameInterval);

      const stream = canvas.captureStream(fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
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
      };

      mediaRecorder.start();

      // Render frames
      for (let frame = 0; frame < totalFrames; frame++) {
        const time = frame * frameInterval;
        renderFrame(ctx, time, canvas);
        setExportProgress(Math.round((frame / totalFrames) * 100));
        await new Promise(resolve => setTimeout(resolve, frameInterval));
      }

      mediaRecorder.stop();
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
