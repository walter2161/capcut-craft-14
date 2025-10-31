import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PropertyForm } from '@/components/property/PropertyForm';
import { CopyGenerator } from '@/components/property/CopyGenerator';
import { Video, ArrowRight, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '@/store/editorStore';

const PropertyPostGenerator = () => {
  const navigate = useNavigate();
  const { updateGlobalSettings } = useEditorStore();

  const goToEditor = () => {
    // Garantir formato 9:16
    updateGlobalSettings({ videoFormat: '9:16' });
    navigate('/editor');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Home className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Gerador de Posts de Imóveis</h1>
                <p className="text-sm text-muted-foreground">Crie reels 9:16 profissionais para suas redes sociais</p>
              </div>
            </div>
            <Button onClick={goToEditor} size="lg">
              <Video className="w-5 h-5 mr-2" />
              Ir para o Editor
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PropertyForm />
          <CopyGenerator />
        </div>

        <div className="mt-8 p-6 bg-card rounded-lg border">
          <h3 className="text-lg font-semibold mb-3">Como funciona?</h3>
          <ol className="space-y-2 text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-bold text-primary">1.</span>
              Preencha os dados do imóvel no formulário
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary">2.</span>
              Configure sua chave API da Mistral e gere a copy automaticamente
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary">3.</span>
              Vá para o editor e adicione suas fotos/vídeos do imóvel
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary">4.</span>
              Organize na timeline (formato 9:16 já configurado)
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary">5.</span>
              Exporte seu vídeo pronto para Instagram, TikTok e outras redes!
            </li>
          </ol>
        </div>
      </main>
    </div>
  );
};

export default PropertyPostGenerator;
