import { useEditorStore } from "@/store/editorStore";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const PropertiesPanel = () => {
  const { selectedClipId, selectedClipIds, clips, updateClip, removeClip, duplicateClip } = useEditorStore();
  const selectedClip = clips.find(c => c.id === selectedClipId);

  if (!selectedClip) {
    return (
      <aside className="w-72 bg-[hsl(var(--editor-panel))] border-l border-border p-4">
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b-2 border-primary">
          🎥 Propriedades do Clipe
        </h3>
        <p className="text-muted-foreground text-sm">
          Selecione um clipe na Linha do Tempo para editar suas propriedades.
        </p>
      </aside>
    );
  }

  const handleChange = (property: string, value: number[]) => {
    updateClip(selectedClip.id, { [property]: value[0] });
  };

  const handleDelete = () => {
    if (selectedClipId) {
      removeClip(selectedClipId);
    }
  };

  const handleDuplicate = () => {
    if (selectedClipId) {
      duplicateClip(selectedClipId);
    }
  };

  return (
    <aside className="w-72 bg-[hsl(var(--editor-panel))] border-l border-border p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-primary">
        <h3 className="text-lg font-semibold">🎥 Propriedades</h3>
        {selectedClipIds.length > 0 && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleDuplicate}>
              <i className="fas fa-copy" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500">
              <i className="fas fa-trash" />
            </Button>
          </div>
        )}
      </div>

      {(selectedClip.type === 'image' || selectedClip.type === 'video') && (
        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-4">Transformação & Visual</h4>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Escala/Zoom</Label>
                  <span className="text-sm font-semibold">{Math.round(selectedClip.scale * 100)}%</span>
                </div>
                <Slider
                  value={[selectedClip.scale]}
                  onValueChange={(v) => handleChange('scale', v)}
                  min={0.1}
                  max={2}
                  step={0.01}
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Brilho</Label>
                  <span className="text-sm font-semibold">{selectedClip.brightness}</span>
                </div>
                <Slider
                  value={[selectedClip.brightness]}
                  onValueChange={(v) => handleChange('brightness', v)}
                  min={-100}
                  max={100}
                  step={1}
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Contraste</Label>
                  <span className="text-sm font-semibold">{selectedClip.contrast}</span>
                </div>
                <Slider
                  value={[selectedClip.contrast]}
                  onValueChange={(v) => handleChange('contrast', v)}
                  min={-100}
                  max={100}
                  step={1}
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Opacidade</Label>
                  <span className="text-sm font-semibold">{Math.round(selectedClip.opacity * 100)}%</span>
                </div>
                <Slider
                  value={[selectedClip.opacity]}
                  onValueChange={(v) => handleChange('opacity', v)}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-4">Duração</h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Duração (ms)</Label>
                  <span className="text-sm font-semibold">{selectedClip.duration}ms</span>
                </div>
                <Slider
                  value={[selectedClip.duration]}
                  onValueChange={(v) => handleChange('duration', v)}
                  min={500}
                  max={10000}
                  step={100}
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Transição</Label>
                  <span className="text-sm font-semibold">
                    {selectedClip.transition === 'cross-fade' ? 'Cross Fade' : 'Nenhuma'}
                  </span>
                </div>
                <select
                  value={selectedClip.transition || 'cross-fade'}
                  onChange={(e) => updateClip(selectedClip.id, { transition: e.target.value as any })}
                  className="w-full p-2 rounded bg-background border border-border"
                >
                  <option value="cross-fade">Cross Fade</option>
                  <option value="none">Nenhuma</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Duração Transição (ms)</Label>
                  <span className="text-sm font-semibold">{selectedClip.transitionDuration || 500}ms</span>
                </div>
                <Slider
                  value={[selectedClip.transitionDuration || 500]}
                  onValueChange={(v) => handleChange('transitionDuration', v)}
                  min={100}
                  max={2000}
                  step={100}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedClip.type === 'audio' && (
        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-4">Ajustes de Áudio</h4>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Volume</Label>
                  <span className="text-sm font-semibold">{Math.round(selectedClip.volume * 100)}%</span>
                </div>
                <Slider
                  value={[selectedClip.volume]}
                  onValueChange={(v) => handleChange('volume', v)}
                  min={0}
                  max={2}
                  step={0.01}
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Velocidade</Label>
                  <span className="text-sm font-semibold">{selectedClip.speed.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[selectedClip.speed]}
                  onValueChange={(v) => handleChange('speed', v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedClip.type === 'subtitle' && (
        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-4">Configurações da Legenda</h4>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Texto da Legenda</Label>
                <Textarea
                  value={selectedClip.text || ''}
                  onChange={(e) => updateClip(selectedClip.id, { text: e.target.value })}
                  placeholder="Digite o texto da legenda..."
                  className="min-h-24"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Velocidade de Leitura</Label>
                  <span className="text-sm font-semibold">{selectedClip.speed?.toFixed(1) || '1.0'}x</span>
                </div>
                <Slider
                  value={[selectedClip.speed || 1.0]}
                  onValueChange={(v) => handleChange('speed', v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Controla a velocidade do áudio da legenda
                </p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Tempo de Exposição (ms)</Label>
                  <span className="text-sm font-semibold">{selectedClip.duration}ms</span>
                </div>
                <Slider
                  value={[selectedClip.duration]}
                  onValueChange={(v) => handleChange('duration', v)}
                  min={500}
                  max={15000}
                  step={100}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Duração que a legenda fica visível na tela
                </p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-sm">Volume do Áudio</Label>
                  <span className="text-sm font-semibold">{Math.round((selectedClip.volume || 1.0) * 100)}%</span>
                </div>
                <Slider
                  value={[selectedClip.volume || 1.0]}
                  onValueChange={(v) => handleChange('volume', v)}
                  min={0}
                  max={2}
                  step={0.01}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
