import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Captions, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/store/editorStore';
import { usePropertyStore } from '@/store/propertyStore';

const MISTRAL_API_KEY = 'aynCSftAcQBOlxmtmpJqVzco8K4aaTDQ';

export const ScriptPanel = () => {
  const [script, setScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const { addClip, clips, updateTotalDuration } = useEditorStore();
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

IMPORTANTE: Retorne APENAS o texto da narração, sem títulos, sem marcações como "INÍCIO:", "MEIO:", "FIM:", sem asteriscos, sem formatação. Apenas o texto corrido que será lido pela locutora.

O roteiro deve ter:
- Gancho forte e impactante (2-3 frases que prendem atenção)
- Desenvolvimento com detalhes principais do imóvel e localização (3-4 frases)
- Call-to-action claro e urgente (1-2 frases)

Características do roteiro:
- Linguagem clara, natural e conversacional
- Tom entusiasmado mas profissional
- Entre 60-80 palavras (para 30-40 segundos de narração)
- Sem emojis ou hashtags (apenas texto para narração)
- Frases curtas e diretas
- Use os dados reais do imóvel fornecidos acima
- Retorne apenas o texto puro, sem nenhuma formatação ou marcação`;

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

  const generateSubtitles = () => {
    if (!script.trim()) {
      toast.error('Escreva ou gere um roteiro primeiro');
      return;
    }

    setIsGeneratingSubtitles(true);
    toast.info('Gerando legendas...');

    try {
      // Limpar o texto
      const cleanText = script
        .replace(/\*\*/g, '')
        .replace(/INÍCIO:|MEIO:|FIM:/gi, '')
        .replace(/\n\n+/g, ' ')
        .trim();

      // Dividir o roteiro em frases
      const sentences = cleanText
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (sentences.length === 0) {
        toast.error('Não foi possível dividir o roteiro em frases');
        setIsGeneratingSubtitles(false);
        return;
      }

      // Verificar se já existe track de legenda
      const subtitleClips = clips.filter(c => c.track === 'SUB1');
      const startPosition = subtitleClips.reduce((max, clip) => 
        Math.max(max, clip.start + clip.duration), 0
      );

      // Calcular duração baseado no número de palavras (velocidade de fala: ~150 palavras/minuto)
      const calculateDuration = (text: string) => {
        const words = text.split(/\s+/).length;
        const wpm = 150; // palavras por minuto
        const durationSeconds = (words / wpm) * 60;
        // Adicionar um buffer de tempo para respiração entre frases
        return Math.max(2000, Math.ceil(durationSeconds * 1000) + 1000);
      };

      let currentStart = startPosition;
      
      // Criar clips de legenda para cada frase
      sentences.forEach((sentence, index) => {
        const duration = calculateDuration(sentence);
        
        addClip({
          id: `subtitle-${Date.now()}-${index}`,
          type: 'subtitle',
          mediaId: `subtitle-${Date.now()}-${index}`,
          track: 'SUB1',
          start: currentStart,
          duration: duration,
          scale: 1,
          brightness: 0,
          contrast: 0,
          volume: 1,
          speed: 1,
          opacity: 1,
          text: sentence
        });
        
        currentStart += duration;
      });

      updateTotalDuration();
      toast.success(`${sentences.length} legendas adicionadas à timeline!`);
    } catch (error) {
      console.error('Erro ao gerar legendas:', error);
      toast.error('Erro ao gerar legendas. Tente novamente.');
    } finally {
      setIsGeneratingSubtitles(false);
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
        disabled={isGenerating || isGeneratingSubtitles}
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
        onClick={generateSubtitles}
        disabled={!script.trim() || isGeneratingSubtitles || isGenerating}
        className="w-full"
        size="sm"
      >
        {isGeneratingSubtitles ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Gerando Legendas...
          </>
        ) : (
          <>
            <Captions className="w-4 h-4 mr-2" />
            Gerar Legendas
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        As legendas serão adicionadas à timeline e reproduzidas com voz do navegador
      </p>
    </div>
  );
};
