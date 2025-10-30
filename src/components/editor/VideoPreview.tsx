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
