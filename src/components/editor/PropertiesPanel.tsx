import { useEditorStore } from "@/store/editorStore";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export const PropertiesPanel = () => {
  const { selectedClipId, clips, updateClip } = useEditorStore();
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

  return (
    <aside className="w-72 bg-[hsl(var(--editor-panel))] border-l border-border p-4 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-4 pb-2 border-b-2 border-primary">
        🎥 Propriedades do Clipe
      </h3>

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
    </aside>
  );
};
