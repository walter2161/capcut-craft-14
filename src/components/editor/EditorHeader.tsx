import { Video, Save, FolderOpen, Plus, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/store/editorStore";
import { ExportVideoDialog } from "./ExportVideoDialog";
import { ThumbnailEditor } from "./ThumbnailEditor";
import { toast } from "sonner";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";

export const EditorHeader = () => {
  const { clips, mediaItems, globalSettings, projectName, setProjectName, loadProject, resetProject } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSaveProject = () => {
    // Preparar dados sem binários para exportação
    const mediaItemsWithoutData = mediaItems.map(item => ({
      id: item.id,
      type: item.type,
      name: item.name,
      duration: item.duration,
      thumbnail: item.thumbnail,
    }));

    const projectData = {
      projectName,
      clips,
      mediaItems: mediaItemsWithoutData,
      globalSettings,
      version: "1.0",
      exportDate: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Projeto salvo com sucesso!");
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        loadProject(data);
        toast.success(`Projeto "${data.projectName}" carregado com sucesso!`);
        toast.info("Nota: Você precisará reimportar as mídias originais");
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
        toast.error("Erro ao carregar projeto. Verifique o arquivo.");
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <header className="h-14 bg-[hsl(var(--editor-header))] border-b border-border flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 text-primary font-bold shrink-0">
          <Video className="w-5 h-5" />
          <span className="hidden sm:inline">EDITOR PRO</span>
        </div>
        
        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="max-w-xs bg-background/50 border-border"
          placeholder="Nome do projeto"
        />
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <Button 
          onClick={() => navigate('/')}
          variant="ghost"
          size="sm"
          title="Voltar ao formulário"
        >
          <Home className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Início</span>
        </Button>
        
        <Button
          onClick={() => {
            if (confirm('Deseja criar um novo projeto? Isso irá limpar tudo. Salve antes de continuar!')) {
              resetProject();
              toast.success('Novo projeto criado');
            }
          }}
          variant="outline"
          size="sm"
          title="Criar novo projeto"
        >
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
        
        <Button 
          onClick={handleSaveProject}
          variant="outline"
          size="sm"
          disabled={clips.length === 0}
          title="Salvar projeto como JSON"
        >
          <Save className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Salvar</span>
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleLoadProject}
          className="hidden"
        />
        <Button 
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          size="sm"
          title="Abrir projeto JSON"
        >
          <FolderOpen className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Abrir</span>
        </Button>
        
        <ThumbnailEditor />
        
        <ExportVideoDialog />
      </div>
    </header>
  );
};
