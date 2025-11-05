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
      const iniciosCordiais = [
        "Oi, pessoal! Hoje vou mostrar pra vocês um imóvel que está disponível",
        "Olá, gente! Passei aqui pra apresentar um imóvel que pode ser uma ótima opção pra você",
        "Oi, galera! Quero te mostrar rapidamente um imóvel que vale a pena conhecer",
        "Olá, pessoal! Separei um tempinho pra te mostrar esse imóvel que chegou pra venda",
        "Oi, tudo bem? Tenho uma ótima oportunidade e quero te apresentar esse imóvel com calma"
      ];

      const finaisChamada = [
        "Gostou do imóvel? Me chama no WhatsApp que te envio todas as informações",
        "Esse imóvel pode sair rápido, então me chama agora pra ver disponibilidade",
        "Se esse imóvel não for o ideal, me chama que te envio outras opções no mesmo perfil",
        "Quer conhecer pessoalmente? Me chama e agendo uma visita pra você",
        "Gostou do imóvel? Clica no link da bio ou chama no WhatsApp que eu te respondo na hora"
      ];

      const inicioEscolhido = iniciosCordiais[Math.floor(Math.random() * iniciosCordiais.length)];
      const fimEscolhido = finaisChamada[Math.floor(Math.random() * finaisChamada.length)];

      const prompt = `Crie um roteiro profissional para narração de vídeo sobre este imóvel para redes sociais (TikTok/Instagram Reels).

DADOS DO IMÓVEL (USE TODOS ESTES DADOS NO ROTEIRO):
- Tipo: ${propertyData.tipo}
- Transação: ${propertyData.transacao}
- Localização: ${propertyData.bairro}, ${propertyData.cidade}/${propertyData.estado}
- Quartos: ${propertyData.quartos}
- Banheiros: ${propertyData.banheiros}
- Vagas: ${propertyData.vagas}
- Área: ${propertyData.area}m²
- Valor: R$ ${propertyData.valor.toLocaleString('pt-BR')}
${propertyData.condominio ? `- Condomínio: R$ ${propertyData.condominio.toLocaleString('pt-BR')}` : ''}
- Diferenciais: ${propertyData.diferenciais.join(', ') || 'Imóvel de qualidade'}

ESTRUTURA OBRIGATÓRIA DO ROTEIRO:

1. INÍCIO (copie exatamente):
"${inicioEscolhido}"

2. MEIO (crie 5-7 frases INCLUINDO OBRIGATORIAMENTE):
- Mencione o tipo de imóvel (${propertyData.tipo})
- Fale a localização completa (${propertyData.bairro}, ${propertyData.cidade}/${propertyData.estado})
- Cite TODOS os números: ${propertyData.quartos} quartos, ${propertyData.banheiros} banheiros, ${propertyData.vagas} vagas, ${propertyData.area}m²
- Mencione o valor: R$ ${propertyData.valor.toLocaleString('pt-BR')}
${propertyData.condominio ? `- Fale do condomínio: R$ ${propertyData.condominio.toLocaleString('pt-BR')}` : ''}
- Destaque os diferenciais: ${propertyData.diferenciais.join(', ')}
- Use linguagem natural, entusiasmada e conversacional

3. FIM (copie exatamente):
"${fimEscolhido}"

REGRAS IMPORTANTES:
- Retorne APENAS o texto corrido, sem títulos, marcações, asteriscos ou formatação
- OBRIGATÓRIO incluir TODOS os dados técnicos listados acima
- Entre 100-130 palavras total
- Sem emojis ou hashtags
- Tom profissional mas entusiasmado`;

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
          max_tokens: 600,
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
      
      const iniciosCordiais = [
        "Oi, pessoal! Hoje vou mostrar pra vocês um imóvel que está disponível",
        "Olá, gente! Passei aqui pra apresentar um imóvel que pode ser uma ótima opção pra você",
        "Oi, galera! Quero te mostrar rapidamente um imóvel que vale a pena conhecer",
        "Olá, pessoal! Separei um tempinho pra te mostrar esse imóvel que chegou pra venda",
        "Oi, tudo bem? Tenho uma ótima oportunidade e quero te apresentar esse imóvel com calma"
      ];

      const finaisChamada = [
        "Gostou do imóvel? Me chama no WhatsApp que te envio todas as informações",
        "Esse imóvel pode sair rápido, então me chama agora pra ver disponibilidade",
        "Se esse imóvel não for o ideal, me chama que te envio outras opções no mesmo perfil",
        "Quer conhecer pessoalmente? Me chama e agendo uma visita pra você",
        "Gostou do imóvel? Clica no link da bio ou chama no WhatsApp que eu te respondo na hora"
      ];

      const inicioEscolhido = iniciosCordiais[Math.floor(Math.random() * iniciosCordiais.length)];
      const fimEscolhido = finaisChamada[Math.floor(Math.random() * finaisChamada.length)];
      
      const fallback = `${inicioEscolhido}. Este ${tipo.toLowerCase()} incrível em ${bairro} tem ${quartos} quartos e está localizado em ${cidade}. Amplo, bem localizado e com acabamento de qualidade. ${valor ? `Por apenas ${valor}.` : ''} ${fimEscolhido}.`;
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
