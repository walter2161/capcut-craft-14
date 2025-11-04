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
  const [activeTab, setActiveTab] = useState('preview');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleSave = () => {
    updateThumbnailData(formData);
    toast.success("Thumbnail atualizada com sucesso!");
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setFormData(thumbnailData);
      setActiveTab('preview');
    }
    setIsOpen(open);
  };

  // Obter dimensões do canvas baseado no formato
  const getCanvasDimensions = () => {
    switch (globalSettings.videoFormat) {
      case '9:16':
        return { width: 540, height: 960 };
      case '1:1':
        return { width: 600, height: 600 };
      case '16:9':
      default:
        return { width: 960, height: 540 };
    }
  };

  const canvasDimensions = getCanvasDimensions();

  // Função para renderizar thumbnail
  const renderThumbnail = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pegar primeira imagem
    const firstImageClip = clips.find(c => c.type === 'image' && c.track.startsWith('V'));
    
    if (!firstImageClip) {
      ctx.fillStyle = '#666666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Adicione uma imagem na timeline', canvas.width / 2, canvas.height / 2);
      return;
    }

    const mediaItem = mediaItems.find(m => m.id === firstImageClip.mediaId);
    
    if (!mediaItem) {
      ctx.fillStyle = '#666666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Imagem não encontrada', canvas.width / 2, canvas.height / 2);
      return;
    }

    const img = new Image();
    
    img.onerror = () => {
      ctx.fillStyle = '#ff6666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Erro ao carregar imagem', canvas.width / 2, canvas.height / 2);
    };
    
    img.onload = () => {
      // Desenhar imagem de fundo
      const imgRatio = img.width / img.height;
      let drawWidth, drawHeight, offsetX, offsetY;
      
      if (globalSettings.mediaFitMode === 'fit-height') {
        drawHeight = canvas.height;
        drawWidth = imgRatio * drawHeight;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
      } else if (globalSettings.mediaFitMode === 'fit-width') {
        drawWidth = canvas.width;
        drawHeight = drawWidth / imgRatio;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
      } else {
        const canvasRatio = canvas.width / canvas.height;
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
      
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      // Overlay escuro
      ctx.fillStyle = `rgba(0, 0, 0, ${formData.overlayOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Card centralizado em área 1:1
      const squareSize = Math.min(canvas.width, canvas.height);
      const squareX = (canvas.width - squareSize) / 2;
      const squareY = (canvas.height - squareSize) / 2;
      const cardPadding = squareSize * formData.cardPadding;
      const cardX = squareX + cardPadding;
      const cardY = squareY + cardPadding;
      const cardWidth = squareSize - (cardPadding * 2);
      const cardHeight = squareSize - (cardPadding * 2);

      // Converter hex para rgba
      const hexToRgba = (hex: string, opacity: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      };

      // Fundo do card
      ctx.fillStyle = hexToRgba(formData.cardBgColor, formData.cardBgOpacity);
      
      if (formData.borderRadius > 0) {
        const radius = formData.borderRadius;
        ctx.beginPath();
        ctx.moveTo(cardX + radius, cardY);
        ctx.lineTo(cardX + cardWidth - radius, cardY);
        ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + radius);
        ctx.lineTo(cardX + cardWidth, cardY + cardHeight - radius);
        ctx.quadraticCurveTo(cardX + cardWidth, cardY + cardHeight, cardX + cardWidth - radius, cardY + cardHeight);
        ctx.lineTo(cardX + radius, cardY + cardHeight);
        ctx.quadraticCurveTo(cardX, cardY + cardHeight, cardX, cardY + cardHeight - radius);
        ctx.lineTo(cardX, cardY + radius);
        ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
      }

      // Borda do card
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 2;
      if (formData.borderRadius > 0) {
        const radius = formData.borderRadius;
        ctx.beginPath();
        ctx.moveTo(cardX + radius, cardY);
        ctx.lineTo(cardX + cardWidth - radius, cardY);
        ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + radius);
        ctx.lineTo(cardX + cardWidth, cardY + cardHeight - radius);
        ctx.quadraticCurveTo(cardX + cardWidth, cardY + cardHeight, cardX + cardWidth - radius, cardY + cardHeight);
        ctx.lineTo(cardX + radius, cardY + cardHeight);
        ctx.quadraticCurveTo(cardX, cardY + cardHeight, cardX, cardY + cardHeight - radius);
        ctx.lineTo(cardX, cardY + radius);
        ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);
      }

      // Renderizar textos
      const baseFontSize = squareSize * 0.05;
      const lineHeight = baseFontSize * 1.5;
      let currentY = cardY + cardHeight * 0.15;

      // Título
      if (formData.title) {
        ctx.fillStyle = formData.titleColor;
        ctx.font = `bold ${baseFontSize * formData.titleFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(formData.title, cardX + cardWidth / 2, currentY);
        currentY += lineHeight * 2;
      }

      // Preço
      if (formData.price) {
        ctx.fillStyle = formData.priceColor;
        ctx.font = `bold ${baseFontSize * formData.priceFontSize}px Arial`;
        ctx.fillText(formData.price, cardX + cardWidth / 2, currentY);
        currentY += lineHeight * 2.5;
      }

      // Características em grid
      const startY = currentY;
      ctx.font = `${baseFontSize * formData.textFontSize}px Arial`;

      if (formData.bedrooms) {
        const x = cardX + cardWidth * 0.25;
        ctx.fillStyle = formData.textColor;
        ctx.fillText('🛏️', x, startY);
        ctx.fillText(`${formData.bedrooms} quartos`, x, startY + lineHeight);
      }

      if (formData.bathrooms) {
        const x = cardX + cardWidth * 0.75;
        ctx.fillStyle = formData.textColor;
        ctx.fillText('🚿', x, startY);
        ctx.fillText(`${formData.bathrooms} banheiros`, x, startY + lineHeight);
      }

      currentY += lineHeight * 3;

      if (formData.area) {
        ctx.fillStyle = formData.textColor;
        ctx.fillText(`📐 ${formData.area} m²`, cardX + cardWidth / 2, currentY);
      }

      // Localização no rodapé
      if (formData.location) {
        currentY = cardY + cardHeight - cardHeight * 0.15;
        ctx.fillStyle = formData.locationColor;
        ctx.font = `${baseFontSize * formData.textFontSize * 0.9}px Arial`;
        ctx.fillText(`📍 ${formData.location}`, cardX + cardWidth / 2, currentY);
      }

      // Código de referência
      if (formData.referencia) {
        currentY = cardY + cardHeight - cardHeight * 0.05;
        ctx.fillStyle = formData.textColor;
        ctx.font = `${baseFontSize * formData.textFontSize * 0.8}px Arial`;
        ctx.fillText(`REF: ${formData.referencia}`, cardX + cardWidth / 2, currentY);
      }
    };

    // Lidar com diferentes tipos de dados de imagem
    if (mediaItem.data instanceof HTMLImageElement) {
      if (mediaItem.data.complete && mediaItem.data.naturalWidth > 0) {
        img.src = mediaItem.data.src;
      } else {
        mediaItem.data.onload = () => {
          img.src = mediaItem.data.src;
        };
      }
    } else if (typeof mediaItem.data === 'string') {
      img.src = mediaItem.data;
    } else if (mediaItem.data instanceof Blob || mediaItem.data instanceof File) {
      const url = URL.createObjectURL(mediaItem.data);
      img.onload = () => {
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  // Renderizar preview da thumbnail
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !formData.enabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderThumbnail(ctx, canvas);
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
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview ao Vivo</TabsTrigger>
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
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    width={canvasDimensions.width}
                    height={canvasDimensions.height}
                    className="max-w-full h-auto"
                    style={{ maxHeight: '60vh' }}
                  />
                </div>
                
                {/* Controles rápidos de visualização */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Opacidade Overlay: {(formData.overlayOpacity * 100).toFixed(0)}%</Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.overlayOpacity}
                      onChange={(e) => setFormData({ ...formData, overlayOpacity: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Opacidade Card: {(formData.cardBgOpacity * 100).toFixed(0)}%</Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.cardBgOpacity}
                      onChange={(e) => setFormData({ ...formData, cardBgOpacity: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
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
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Informações do Imóvel</h3>
                  
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

                  <div className="space-y-2">
                    <Label htmlFor="referencia">Código Referência</Label>
                    <Input
                      id="referencia"
                      placeholder="Ex: 12345"
                      value={formData.referencia}
                      onChange={(e) => 
                        setFormData({ ...formData, referencia: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Cores</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardBg">Fundo do Card</Label>
                      <Input
                        id="cardBg"
                        type="color"
                        value={formData.cardBgColor}
                        onChange={(e) => 
                          setFormData({ ...formData, cardBgColor: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="titleColor">Cor do Título</Label>
                      <Input
                        id="titleColor"
                        type="color"
                        value={formData.titleColor}
                        onChange={(e) => 
                          setFormData({ ...formData, titleColor: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priceColor">Cor do Preço</Label>
                      <Input
                        id="priceColor"
                        type="color"
                        value={formData.priceColor}
                        onChange={(e) => 
                          setFormData({ ...formData, priceColor: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="textColor">Cor do Texto</Label>
                      <Input
                        id="textColor"
                        type="color"
                        value={formData.textColor}
                        onChange={(e) => 
                          setFormData({ ...formData, textColor: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="locationColor">Cor Localização</Label>
                      <Input
                        id="locationColor"
                        type="color"
                        value={formData.locationColor}
                        onChange={(e) => 
                          setFormData({ ...formData, locationColor: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Tamanhos de Fonte</h3>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Título: {formData.titleFontSize.toFixed(1)}x</Label>
                      <input
                        type="range"
                        min="0.8"
                        max="2.5"
                        step="0.1"
                        value={formData.titleFontSize}
                        onChange={(e) => setFormData({ ...formData, titleFontSize: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Preço: {formData.priceFontSize.toFixed(1)}x</Label>
                      <input
                        type="range"
                        min="0.8"
                        max="2.5"
                        step="0.1"
                        value={formData.priceFontSize}
                        onChange={(e) => setFormData({ ...formData, priceFontSize: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Texto: {formData.textFontSize.toFixed(1)}x</Label>
                      <input
                        type="range"
                        min="0.6"
                        max="1.8"
                        step="0.1"
                        value={formData.textFontSize}
                        onChange={(e) => setFormData({ ...formData, textFontSize: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Estilo</h3>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Arredondamento: {formData.borderRadius}px</Label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        step="5"
                        value={formData.borderRadius}
                        onChange={(e) => setFormData({ ...formData, borderRadius: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Espaçamento Card: {(formData.cardPadding * 100).toFixed(0)}%</Label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.2"
                        step="0.01"
                        value={formData.cardPadding}
                        onChange={(e) => setFormData({ ...formData, cardPadding: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              
              const link = document.createElement('a');
              link.download = 'thumbnail.png';
              link.href = canvas.toDataURL();
              link.click();
              toast.success("Thumbnail baixada com sucesso!");
            }}
            disabled={!formData.enabled}
          >
            Baixar Thumb
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Configurações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
