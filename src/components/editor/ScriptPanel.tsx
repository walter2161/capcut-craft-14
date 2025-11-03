import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Volume2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/store/editorStore';
import { usePropertyStore } from '@/store/propertyStore';

const MISTRAL_API_KEY = 'aynCSftAcQBOlxmtmpJqVzco8K4aaTDQ';

export const ScriptPanel = () => {
  const [script, setScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const { addMediaItem, addClip, clips, updateTotalDuration } = useEditorStore();
  const { propertyData } = usePropertyStore();

  const generateScript = async () => {
    if (!propertyData) {
      toast.error('Escaneie um imóvel primeiro na página inicial');
      return;
    }

    setIsGenerating(true);

    try {
      const prompt = `Crie um roteiro profissional para narração de vídeo sobre este imóvel para redes sociais (TikTok/Instagram Reels):

Tipo: ${propertyData.tipo}
Transação: ${propertyData.transacao}
Localização: ${propertyData.bairro}, ${propertyData.cidade}/${propertyData.estado}
Características: ${propertyData.quartos} quartos, ${propertyData.banheiros} banheiros, ${propertyData.vagas} vagas, ${propertyData.area}m²
Valor: R$ ${propertyData.valor.toLocaleString('pt-BR')}
${propertyData.condominio ? `Condomínio: R$ ${propertyData.condominio.toLocaleString('pt-BR')}` : ''}
Diferenciais: ${propertyData.diferenciais.join(', ') || 'Imóvel de qualidade'}

O roteiro deve ter:
- INÍCIO: Gancho forte e impactante (2-3 frases que prendem atenção)
- MEIO: Desenvolvimento com detalhes principais do imóvel e localização (3-4 frases)
- FIM: Call-to-action claro e urgente (1-2 frases)

Características do roteiro:
- Linguagem clara, natural e conversacional
- Tom entusiasmado mas profissional
- Entre 60-80 palavras (para 30-40 segundos de narração)
- Sem emojis ou hashtags (apenas texto para narração)
- Frases curtas e diretas
- Use os dados reais do imóvel fornecidos acima`;

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 400,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro na API da Mistral');
      }

      const data = await response.json();
      const generatedScript = data.choices[0].message.content;
      setScript(generatedScript);
      toast.success('Roteiro gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar roteiro:', error);
      
      if (!propertyData) {
        toast.error('Dados do imóvel não disponíveis');
        setIsGenerating(false);
        return;
      }

      const tipo = propertyData.tipo || 'Imóvel';
      const cidade = propertyData.cidade || '';
      const bairro = propertyData.bairro || '';
      const quartos = propertyData.quartos || 0;
      const valor = propertyData.valor ? `R$ ${propertyData.valor.toLocaleString('pt-BR')}` : '';
      
      const fallback = `Você está procurando o ${tipo.toLowerCase()} perfeito em ${bairro}? Então presta atenção!

Este ${tipo.toLowerCase()} incrível tem ${quartos} quartos e está localizado em ${cidade}. Amplo, bem localizado e com acabamento de qualidade. ${valor ? `Por apenas ${valor}.` : ''}

Não perca essa oportunidade! Entre em contato agora mesmo e agende sua visita. Esse imóvel não vai ficar disponível por muito tempo!`;
      setScript(fallback);
      toast.success('Roteiro gerado (fallback)');
    } finally {
      setIsGenerating(false);
    }
  };

  const convertToAudio = async () => {
    if (!script.trim()) {
      toast.error('Escreva ou gere um roteiro primeiro');
      return;
    }

    // Verificar se Puter está disponível
    if (!(window as any).puter) {
      toast.error('Puter.js não está carregado');
      return;
    }

    setIsConverting(true);
    toast.info('Gerando áudio da narração com Puter.js...');

    try {
      // Usar Puter.js para gerar áudio
      const audioBlob = await (window as any).puter.ai.txt2speech(script);
      
      // Converter blob para ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Criar AudioContext e decodificar
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Adicionar à biblioteca de mídia
      const mediaId = `audio-script-${Date.now()}`;
      addMediaItem({
        id: mediaId,
        type: 'audio',
        name: 'Narração do Roteiro',
        data: audioBuffer,
        duration: audioBuffer.duration * 1000
      });

      // Adicionar à timeline
      const audioClips = clips.filter(c => c.type === 'audio' && c.track === 'A1');
      const lastPosition = audioClips.reduce((max, clip) => 
        Math.max(max, clip.start + clip.duration), 0
      );

      addClip({
        id: `clip-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        type: 'audio',
        mediaId,
        track: 'A1',
        start: lastPosition,
        duration: audioBuffer.duration * 1000,
        scale: 1,
        brightness: 0,
        contrast: 0,
        volume: 1,
        speed: 1,
        opacity: 1,
        transition: 'none',
        transitionDuration: 0
      });

      updateTotalDuration();
      await audioContext.close();
      toast.success('Áudio adicionado à timeline!');

    } catch (error) {
      console.error('Erro ao converter áudio:', error);
      toast.error('Erro ao gerar áudio com Puter.js');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Roteiro IA
        </h3>
      </div>

      <Button
        onClick={generateScript}
        disabled={isGenerating || isConverting}
        variant="secondary"
        className="w-full"
        size="sm"
      >
        {isGenerating ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar Roteiro
          </>
        )}
      </Button>

      <div className="flex-1 flex flex-col space-y-2">
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Clique em 'Gerar Roteiro' para criar um roteiro com IA, ou escreva seu próprio roteiro aqui..."
          className="flex-1 resize-none text-sm"
        />
      </div>

      <Button
        onClick={convertToAudio}
        disabled={!script.trim() || isConverting || isGenerating}
        className="w-full"
        size="sm"
      >
        {isConverting ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Convertendo...
          </>
        ) : (
          <>
            <Volume2 className="w-4 h-4 mr-2" />
            Converter em Áudio
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        O áudio será automaticamente adicionado à timeline
      </p>
    </div>
  );
};
