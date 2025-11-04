import { useState, useEffect, useRef } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEditorStore } from "@/store/editorStore";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const ThumbnailEditor = () => {
  const { thumbnailData, updateThumbnailData, clips, mediaItems, globalSettings } = useEditorStore();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState(thumbnailData);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleSave = () => {
    updateThumbnailData(formData);
    toast.success("Thumbnail atualizada com sucesso!");
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setFormData(thumbnailData);
    }
    setIsOpen(open);
  };

  // Renderizar preview da thumbnail
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !formData.enabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pegar primeira imagem
    const firstImageClip = clips.find(c => c.type === 'image' && c.track.startsWith('V'));
    if (!firstImageClip) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Adicione uma imagem na timeline', canvas.width / 2, canvas.height / 2);
      return;
    }

    const mediaItem = mediaItems.find(m => m.id === firstImageClip.mediaId);
    if (!mediaItem) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Desenhar imagem de fundo
      const imgRatio = img.width / img.height;
      const canvasRatio = canvas.width / canvas.height;
      
      let drawWidth, drawHeight, offsetX, offsetY;
      if (globalSettings.mediaFitMode === 'fit-height') {
        drawHeight = canvas.height;
        drawWidth = imgRatio * drawHeight;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
      } else {
        drawWidth = canvas.width;
        drawHeight = drawWidth / imgRatio;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
      }
      
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      // Overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Card centralizado
      const squareSize = Math.min(canvas.width, canvas.height);
      const squareX = (canvas.width - squareSize) / 2;
      const squareY = (canvas.height - squareSize) / 2;
      const cardPadding = squareSize * 0.1;
      const cardX = squareX + cardPadding;
      const cardY = squareY + cardPadding;
      const cardWidth = squareSize - (cardPadding * 2);
      const cardHeight = squareSize - (cardPadding * 2);

      // Fundo do card
      const gradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      gradient.addColorStop(1, 'rgba(240, 240, 240, 0.95)');
      ctx.fillStyle = gradient;
      ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

      // Borda
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);

      // Textos
      const fontSize = squareSize * 0.05;
      const lineHeight = fontSize * 1.5;
      let currentY = cardY + cardHeight * 0.15;

      // Título
      if (formData.title) {
        ctx.fillStyle = '#1a1a1a';
        ctx.font = `bold ${fontSize * 1.4}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(formData.title, cardX + cardWidth / 2, currentY);
        currentY += lineHeight * 2;
      }

      // Preço
      if (formData.price) {
        ctx.fillStyle = '#16a34a';
        ctx.font = `bold ${fontSize * 1.8}px Arial`;
        ctx.fillText(formData.price, cardX + cardWidth / 2, currentY);
        currentY += lineHeight * 2.5;
      }

      // Características
      const startY = currentY;
      ctx.font = `${fontSize}px Arial`;

      if (formData.bedrooms) {
        const x = cardX + cardWidth * 0.25;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText('🛏️', x, startY);
        ctx.fillText(`${formData.bedrooms} quartos`, x, startY + lineHeight);
      }

      if (formData.bathrooms) {
        const x = cardX + cardWidth * 0.75;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText('🚿', x, startY);
        ctx.fillText(`${formData.bathrooms} banheiros`, x, startY + lineHeight);
      }

      currentY += lineHeight * 3;

      if (formData.area) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(`📐 ${formData.area} m²`, cardX + cardWidth / 2, currentY);
      }

      // Localização
      if (formData.location) {
        currentY = cardY + cardHeight - cardHeight * 0.15;
        ctx.fillStyle = '#666666';
        ctx.font = `${fontSize * 0.9}px Arial`;
        ctx.fillText(`📍 ${formData.location}`, cardX + cardWidth / 2, currentY);
      }
    };

    if (mediaItem.data instanceof HTMLImageElement) {
      img.src = mediaItem.data.src;
    } else if (typeof mediaItem.data === 'string') {
      img.src = mediaItem.data;
    }
  }, [isOpen, formData, clips, mediaItems, globalSettings]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          title="Editar thumbnail do vídeo"
          className={thumbnailData.enabled ? "border-primary text-primary" : ""}
        >
          <ImageIcon className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Thumb</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thumbnail do Vídeo</DialogTitle>
          <DialogDescription>
            Configure a tela inicial de 1 segundo com as informações do imóvel
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>
          
          <TabsContent value="preview" className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="enabled-preview">Ativar Thumbnail</Label>
              <Switch
                id="enabled-preview"
                checked={formData.enabled}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, enabled: checked })
                }
              />
            </div>
            
            {formData.enabled ? (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={540}
                  height={960}
                  className="w-full h-auto"
                  style={{ maxHeight: '60vh' }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                <p className="text-muted-foreground">Ative a thumbnail para ver o preview</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Ativar Thumbnail</Label>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, enabled: checked })
              }
            />
          </div>

          {formData.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Título do Imóvel</Label>
                <Input
                  id="title"
                  placeholder="Ex: Casa Moderna no Centro"
                  value={formData.title}
                  onChange={(e) => 
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Preço</Label>
                <Input
                  id="price"
                  placeholder="Ex: R$ 850.000"
                  value={formData.price}
                  onChange={(e) => 
                    setFormData({ ...formData, price: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Quartos</Label>
                  <Input
                    id="bedrooms"
                    placeholder="3"
                    value={formData.bedrooms}
                    onChange={(e) => 
                      setFormData({ ...formData, bedrooms: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Banheiros</Label>
                  <Input
                    id="bathrooms"
                    placeholder="2"
                    value={formData.bathrooms}
                    onChange={(e) => 
                      setFormData({ ...formData, bathrooms: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area">Área (m²)</Label>
                  <Input
                    id="area"
                    placeholder="120"
                    value={formData.area}
                    onChange={(e) => 
                      setFormData({ ...formData, area: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Localização</Label>
                <Input
                  id="location"
                  placeholder="Ex: Centro, São Paulo - SP"
                  value={formData.location}
                  onChange={(e) => 
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
            </>
          )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
