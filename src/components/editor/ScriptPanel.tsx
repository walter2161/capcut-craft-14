import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Volume2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/store/editorStore';

const MISTRAL_API_KEY = 'aynCSftAcQBOlxmtmpJqVzco8K4aaTDQ';

export const ScriptPanel = () => {
  const [script, setScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const { addMediaItem, addClip, clips, updateTotalDuration } = useEditorStore();

  const generateScript = async () => {
    setIsGenerating(true);

    try {
      const prompt = `Crie um roteiro profissional para narração de vídeo sobre imóveis para redes sociais (TikTok/Instagram Reels).

O roteiro deve ter:
- INÍCIO: Gancho forte e impactante (2-3 frases que prendem atenção)
- MEIO: Desenvolvimento com detalhes principais do imóvel e localização (3-4 frases)
- FIM: Call-to-action claro e urgente (1-2 frases)

Características:
- Linguagem clara, natural e conversacional
- Tom entusiasmado mas profissional
- Entre 60-80 palavras (para 30-40 segundos de narração)
- Sem emojis ou hashtags (apenas texto para narração)
- Frases curtas e diretas

Exemplo de tema: Apartamento moderno, 3 quartos, 2 vagas, ótima localização.`;

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
      const fallback = `Você está procurando o imóvel perfeito? Então presta atenção!

Este apartamento incrível tem tudo que você precisa. Amplo, bem localizado e com acabamento moderno. Cozinha planejada, suíte master e varanda gourmet.

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

    if (!('speechSynthesis' in window)) {
      toast.error('Seu navegador não suporta síntese de voz');
      return;
    }

    setIsConverting(true);
    toast.info('Convertendo roteiro em áudio...');

    try {
      // Criar contexto de áudio para gravar
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();
      
      // Configurar síntese de voz
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Tentar usar uma voz em português
      const voices = speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith('pt'));
      if (ptVoice) {
        utterance.voice = ptVoice;
      }

      // MediaRecorder para capturar o áudio
      const mediaRecorder = new MediaRecorder(destination.stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        try {
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

          // Adicionar automaticamente à timeline
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
          toast.success('Áudio adicionado à timeline!');
          setIsConverting(false);
        } catch (err) {
          console.error('Erro ao processar áudio:', err);
          toast.error('Erro ao processar áudio');
          setIsConverting(false);
        }
      };

      // Iniciar gravação
      mediaRecorder.start();

      utterance.onend = () => {
        setTimeout(() => {
          mediaRecorder.stop();
          audioContext.close();
        }, 500);
      };

      utterance.onerror = (event) => {
        console.error('Erro na síntese de voz:', event);
        mediaRecorder.stop();
        audioContext.close();
        toast.error('Erro ao gerar áudio');
        setIsConverting(false);
      };

      speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('Erro ao converter áudio:', error);
      toast.error('Erro ao converter em áudio');
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
