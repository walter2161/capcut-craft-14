import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Copy, RefreshCw } from 'lucide-react';
import { usePropertyStore } from '@/store/propertyStore';
import { toast } from 'sonner';

const MISTRAL_API_KEY = 'aynCSftAcQBOlxmtmpJqVzco8K4aaTDQ';

export const CopyGenerator = () => {
  const { propertyData, generatedCopy, setGeneratedCopy } = usePropertyStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateCopy = async () => {
    if (!propertyData) {
      toast.error('Preencha os dados do imóvel primeiro');
      return;
    }

    setIsGenerating(true);

    try {
      const prompt = `Crie uma copy persuasiva e atraente para um post de rede social (Instagram/TikTok) sobre este imóvel:

Tipo: ${propertyData.tipo}
Transação: ${propertyData.transacao}
Referência: ${propertyData.referencia || ''}
Localização: ${propertyData.bairro}, ${propertyData.cidade}/${propertyData.estado}
Características: ${propertyData.quartos} quartos, ${propertyData.banheiros} banheiros, ${propertyData.vagas} vagas, ${propertyData.area}m²
Valor: R$ ${propertyData.valor.toLocaleString('pt-BR')}
${propertyData.condominio ? `Condomínio: R$ ${propertyData.condominio.toLocaleString('pt-BR')}` : ''}
Diferenciais: ${propertyData.diferenciais.join(', ') || 'Nenhum informado'}
${propertyData.descricaoAdicional ? `Observações: ${propertyData.descricaoAdicional}` : ''}

Corretor: ${propertyData.nomeCorretor}
Contato: ${propertyData.telefoneCorretor}

A copy deve:
- Ser curta e impactante (máximo 150 palavras)
- Usar emojis estrategicamente
- Destacar os principais diferenciais
- Incluir código de referência (REF: ${propertyData.referencia || ''})
- Criar senso de urgência
- Incluir call-to-action forte
- Incluir hashtags relevantes (#imoveis #${propertyData.cidade.toLowerCase()})`;

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
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro na API da Mistral');
      }

      const data = await response.json();
      const copy = data.choices[0].message.content;
      setGeneratedCopy(copy);
      toast.success('Copy gerada com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar copy:', error);
      const cidade = propertyData.cidade || '';
      const bairro = propertyData.bairro || '';
      const tipo = propertyData.tipo || 'Imóvel';
      const transacao = propertyData.transacao || 'Venda';
      const valor = propertyData.valor ? `por R$ ${propertyData.valor.toLocaleString('pt-BR')}` : '';
      const caracts = [
        propertyData.quartos ? `${propertyData.quartos} quartos` : null,
        propertyData.banheiros ? `${propertyData.banheiros} banheiros` : null,
        propertyData.vagas ? `${propertyData.vagas} vagas` : null,
        propertyData.area ? `${propertyData.area}m²` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      const difs = propertyData.diferenciais && propertyData.diferenciais.length
        ? `Destaques: ${propertyData.diferenciais.slice(0, 5).join(', ')}.\n`
        : '';

      const ref = propertyData.referencia ? `\n\n📋 REF: ${propertyData.referencia}` : '';
      const fallback = `✨ ${tipo} para ${transacao} em ${bairro} · ${cidade}\n\n${caracts}${valor ? ` \u2014 ${valor}` : ''}\n${difs}\nCorra! Oportunidade única com excelente localização. Fale agora e agende sua visita! 📲${ref}\n\n#imoveis #${cidade.toLowerCase()}`;
      setGeneratedCopy(fallback);
      toast.success('Copy gerada (fallback)');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCopy = () => {
    navigator.clipboard.writeText(generatedCopy);
    toast.success('Copy copiada!');
  };

  return (
    <div className="space-y-4 p-6 bg-card rounded-lg border">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Copy com IA
        </h2>
      </div>

      <div className="space-y-3">
        <Button 
          onClick={generateCopy} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Gerar Copy
            </>
          )}
        </Button>

        {generatedCopy && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Copy Gerada</Label>
              <Button size="sm" variant="outline" onClick={copyCopy}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>
            </div>
            <Textarea 
              value={generatedCopy}
              onChange={(e) => setGeneratedCopy(e.target.value)}
              rows={10}
              className="font-sans"
            />
          </div>
        )}
      </div>
    </div>
  );
};

const Input = ({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props} 
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  />
);
