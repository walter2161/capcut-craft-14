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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden bg-[hsl(var(--editor-panel))]">
        <DialogHeader>
          <DialogTitle>Configurações Gerais do Gerador</DialogTitle>
          <DialogDescription>
            Configure os parâmetros padrão para novos clipes e exportação.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="video" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="video">Vídeo</TabsTrigger>
            <TabsTrigger value="timing">Tempo</TabsTrigger>
            <TabsTrigger value="effects">Efeitos</TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="space-y-6 mt-4 max-h-[50vh] overflow-y-auto pr-2">
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
          </TabsContent>

          <TabsContent value="timing" className="space-y-6 mt-4 max-h-[50vh] overflow-y-auto pr-2">
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

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Limitador de Tempo</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Ativar Limitador</Label>
                  <p className="text-xs text-muted-foreground">
                    Limita o vídeo a um tempo máximo
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={globalSettings.timeLimitEnabled}
                  onChange={(e) =>
                    updateGlobalSettings({ timeLimitEnabled: e.target.checked })
                  }
                  className="h-4 w-4"
                />
              </div>

              {globalSettings.timeLimitEnabled && (
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-sm">Tempo Máximo (segundos)</Label>
                    <span className="text-sm font-semibold">{Math.floor(globalSettings.timeLimit / 1000)}s</span>
                  </div>
                  <Slider
                    value={[globalSettings.timeLimit / 1000]}
                    onValueChange={(v) => updateGlobalSettings({ timeLimit: v[0] * 1000 })}
                    min={10}
                    max={120}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    O vídeo será cortado neste tempo (preview e exportação)
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="effects" className="space-y-6 mt-4 max-h-[50vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Efeitos de Imagem</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Efeito de Pan</Label>
                  <p className="text-xs text-muted-foreground">
                    Deslocamento horizontal em imagens horizontais (vídeo vertical)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={globalSettings.enablePanEffect}
                  onChange={(e) =>
                    updateGlobalSettings({ enablePanEffect: e.target.checked })
                  }
                  className="h-4 w-4"
                />
              </div>

              {globalSettings.enablePanEffect && (
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-sm">Direção do Pan</Label>
                    <span className="text-sm font-semibold">
                      {globalSettings.panDirection === 'ping-pong' && 'Ida e Volta'}
                      {globalSettings.panDirection === 'right' && 'Direita'}
                      {globalSettings.panDirection === 'left' && 'Esquerda'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={globalSettings.panDirection === 'ping-pong' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateGlobalSettings({ panDirection: 'ping-pong' })}
                      className="flex-1"
                    >
                      Ida/Volta
                    </Button>
                    <Button
                      variant={globalSettings.panDirection === 'right' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateGlobalSettings({ panDirection: 'right' })}
                      className="flex-1"
                    >
                      Direita
                    </Button>
                    <Button
                      variant={globalSettings.panDirection === 'left' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateGlobalSettings({ panDirection: 'left' })}
                      className="flex-1"
                    >
                      Esquerda
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sentido do movimento horizontal
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Efeito de Zoom</Label>
                  <p className="text-xs text-muted-foreground">
                    Zoom in/out suave nas imagens do centro
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={globalSettings.enableZoomEffect}
                  onChange={(e) =>
                    updateGlobalSettings({ enableZoomEffect: e.target.checked })
                  }
                  className="h-4 w-4"
                />
              </div>

              {globalSettings.enableZoomEffect && (
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-sm">Direção do Zoom</Label>
                    <span className="text-sm font-semibold">
                      {globalSettings.zoomDirection === 'in' && 'Zoom In'}
                      {globalSettings.zoomDirection === 'out' && 'Zoom Out'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={globalSettings.zoomDirection === 'in' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateGlobalSettings({ zoomDirection: 'in' })}
                      className="flex-1"
                    >
                      Zoom In
                    </Button>
                    <Button
                      variant={globalSettings.zoomDirection === 'out' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateGlobalSettings({ zoomDirection: 'out' })}
                      className="flex-1"
                    >
                      Zoom Out
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aumentar (in) ou diminuir (out) o zoom ao longo do tempo
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
