import { useState } from "react";
import { Image } from "lucide-react";
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

export const ThumbnailEditor = () => {
  const { thumbnailData, updateThumbnailData } = useEditorStore();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState(thumbnailData);

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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          title="Editar thumbnail do vídeo"
          className={thumbnailData.enabled ? "border-primary text-primary" : ""}
        >
          <Image className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Thumb</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thumbnail do Vídeo</DialogTitle>
          <DialogDescription>
            Configure a tela inicial de 1 segundo com as informações do imóvel
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
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
        </div>

        <div className="flex justify-end gap-2">
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
