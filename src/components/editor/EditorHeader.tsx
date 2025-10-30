import { Video, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { toast } from "sonner";

export const EditorHeader = () => {
  const { clips } = useEditorStore();
  const hasClips = clips.some(c => c.type === 'image' || c.type === 'video');

  const handleExport = () => {
    if (!hasClips) {
      toast.error("Adicione clipes à linha do tempo para exportar");
      return;
    }
    toast.success("Iniciando exportação do vídeo...");
    // Exportação será implementada posteriormente
  };

  return (
    <header className="h-12 bg-[hsl(var(--editor-header))] border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-primary font-bold">
          <Video className="w-5 h-5" />
          <span>EDITOR PRO</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {hasClips ? "Projeto pronto para edição" : "Carregue mídia para começar"}
        </span>
      </div>
      
      <Button 
        onClick={handleExport}
        disabled={!hasClips}
        className="bg-primary hover:bg-primary/90"
      >
        <Download className="w-4 h-4 mr-2" />
        Exportar Vídeo
      </Button>
    </header>
  );
};
