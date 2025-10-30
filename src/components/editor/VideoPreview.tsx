import { useRef, useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";

export const VideoPreview = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { clips, mediaItems, currentTime, isPlaying } = useEditorStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderFrame(ctx, currentTime);
  }, [currentTime, clips, mediaItems]);

  const renderFrame = (ctx: CanvasRenderingContext2D, time: number) => {
    const canvas = ctx.canvas;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const currentClip = clips.find(
      c => c.track === 'V1' && c.start <= time && c.start + c.duration > time
    );

    if (!currentClip) return;

    const mediaItem = mediaItems.find(m => m.id === currentClip.mediaId);
    if (!mediaItem || !mediaItem.data) return;

    const image = mediaItem.data;
    
    // Aplicar filtros
    ctx.filter = `brightness(${100 + currentClip.brightness}%) contrast(${100 + currentClip.contrast}%)`;
    ctx.globalAlpha = currentClip.opacity;

    // Calcular dimensões para cover fit
    const imgRatio = image.width / image.height;
    const canvasRatio = canvas.width / canvas.height;

    let drawWidth, drawHeight;
    if (imgRatio < canvasRatio) {
      drawWidth = canvas.width;
      drawHeight = drawWidth / imgRatio;
    } else {
      drawHeight = canvas.height;
      drawWidth = drawHeight * imgRatio;
    }

    const scaledWidth = drawWidth * currentClip.scale;
    const scaledHeight = drawHeight * currentClip.scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  };

  return (
    <section className="flex-1 bg-black flex items-center justify-center relative">
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="max-w-full max-h-full shadow-2xl"
        />
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
