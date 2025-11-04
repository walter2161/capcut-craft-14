import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useEditorStore } from "@/store/editorStore";

export const GlobalSettingsDialog = () => {
  const { globalSettings, updateGlobalSettings } = useEditorStore();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="hover:bg-muted">
          <Settings className="w-4 h-4 mr-2" />
          Configurações
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-[hsl(var(--editor-panel))]">
        <DialogHeader>
          <DialogTitle>Configurações Gerais do Gerador</DialogTitle>
          <DialogDescription>
            Configure os parâmetros padrão para novos clipes e exportação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">Formato do Vídeo</Label>
              <span className="text-sm font-semibold">{globalSettings.videoFormat}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={globalSettings.videoFormat === '16:9' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateGlobalSettings({ videoFormat: '16:9' })}
                className="flex-1"
              >
                16:9
              </Button>
              <Button
                variant={globalSettings.videoFormat === '9:16' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateGlobalSettings({ videoFormat: '9:16' })}
                className="flex-1"
              >
                9:16
              </Button>
              <Button
                variant={globalSettings.videoFormat === '1:1' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateGlobalSettings({ videoFormat: '1:1' })}
                className="flex-1"
              >
                1:1
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Proporção de aspecto do vídeo exportado
            </p>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">Duração Padrão de Imagem (ms)</Label>
              <span className="text-sm font-semibold">{globalSettings.defaultImageDuration}ms</span>
            </div>
            <Slider
              value={[globalSettings.defaultImageDuration]}
              onValueChange={(v) => updateGlobalSettings({ defaultImageDuration: v[0] })}
              min={1000}
              max={10000}
              step={100}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Duração padrão para novas imagens adicionadas à timeline
            </p>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">Duração Padrão de Transição (ms)</Label>
              <span className="text-sm font-semibold">{globalSettings.defaultTransitionDuration}ms</span>
            </div>
            <Slider
              value={[globalSettings.defaultTransitionDuration]}
              onValueChange={(v) => updateGlobalSettings({ defaultTransitionDuration: v[0] })}
              min={100}
              max={2000}
              step={100}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Duração padrão para transições cross-fade entre clipes
            </p>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">FPS do Vídeo (Exportação)</Label>
              <span className="text-sm font-semibold">{globalSettings.videoFPS} fps</span>
            </div>
            <Slider
              value={[globalSettings.videoFPS]}
              onValueChange={(v) => updateGlobalSettings({ videoFPS: v[0] })}
              min={24}
              max={60}
              step={1}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Taxa de quadros por segundo para exportação (24, 30, 60)
            </p>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">Ajuste de Mídia</Label>
              <span className="text-sm font-semibold">
                {globalSettings.mediaFitMode === 'fit-width' && 'Expandida Horizontal'}
                {globalSettings.mediaFitMode === 'fit-height' && 'Expandida Vertical'}
                {globalSettings.mediaFitMode === 'contain' && 'Contida'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={globalSettings.mediaFitMode === 'fit-width' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateGlobalSettings({ mediaFitMode: 'fit-width' })}
                className="flex-1"
              >
                Horizontal
              </Button>
              <Button
                variant={globalSettings.mediaFitMode === 'fit-height' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateGlobalSettings({ mediaFitMode: 'fit-height' })}
                className="flex-1"
              >
                Vertical
              </Button>
              <Button
                variant={globalSettings.mediaFitMode === 'contain' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateGlobalSettings({ mediaFitMode: 'contain' })}
                className="flex-1"
              >
                Contida
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Como as mídias devem ser ajustadas no formato do vídeo
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
