import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search } from 'lucide-react';
import { usePropertyStore, PropertyData } from '@/store/propertyStore';
import { useEditorStore, MediaItem } from '@/store/editorStore';
import { useNavigate } from 'react-router-dom';

export const PropertyScanner = () => {
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const { setPropertyData, setGeneratedCopy } = usePropertyStore();
  const { addMediaItem } = useEditorStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const extractPropertyData = (html: string): Partial<PropertyData> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const data: Partial<PropertyData> = {
      diferenciais: [],
      descricaoAdicional: ''
    };

    // Extrair texto do body para análise
    const bodyText = doc.body.innerText || doc.body.textContent || '';
    
    // Tentar extrair valores numéricos básicos
    const quartoMatch = bodyText.match(/(\d+)\s*(quarto|dormitório|dorm)/i);
    if (quartoMatch) data.quartos = parseInt(quartoMatch[1]);
    
    const banheiroMatch = bodyText.match(/(\d+)\s*(banheiro|bath)/i);
    if (banheiroMatch) data.banheiros = parseInt(banheiroMatch[1]);
    
    const vagaMatch = bodyText.match(/(\d+)\s*(vaga|garagem)/i);
    if (vagaMatch) data.vagas = parseInt(vagaMatch[1]);
    
    const areaMatch = bodyText.match(/(\d+(?:,\d+)?)\s*m[²2]/i);
    if (areaMatch) data.area = parseFloat(areaMatch[1].replace(',', '.'));
    
    // Extrair valor
    const valorMatch = bodyText.match(/R\$\s*([\d.,]+)/);
    if (valorMatch) {
      data.valor = parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.'));
    }

    return data;
  };

  const extractImages = (html: string, baseUrl: string): string[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images: string[] = [];
    
    // Procurar por imagens do imóvel
    const imgElements = doc.querySelectorAll('img');
    imgElements.forEach(img => {
      let src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (src && !src.includes('logo') && !src.includes('icon')) {
        // Converter URLs relativas para absolutas
        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          const urlObj = new URL(baseUrl);
          src = urlObj.origin + src;
        }
        if (src.startsWith('http')) {
          images.push(src);
        }
      }
    });
    
    return images.slice(0, 10); // Limitar a 10 imagens
  };

  const generateCopyWithAI = async (propertyData: Partial<PropertyData>, htmlContent: string) => {
    const apiKey = localStorage.getItem('mistral_api_key');
    if (!apiKey) {
      toast({
        title: 'API Key não configurada',
        description: 'Configure sua chave da API Mistral primeiro',
        variant: 'destructive',
      });
      return '';
    }

    try {
      // Extrair descrição do HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const description = doc.body.innerText.slice(0, 2000); // Limitar tamanho

      const prompt = `Com base nas informações do imóvel abaixo, crie uma copy persuasiva e atraente para um post de rede social (Instagram/TikTok):

Tipo: ${propertyData.tipo || 'Imóvel'}
Transação: ${propertyData.transacao || 'Venda'}
Localização: ${propertyData.bairro}, ${propertyData.cidade}/${propertyData.estado}
Características: ${propertyData.quartos} quartos, ${propertyData.banheiros} banheiros, ${propertyData.vagas} vagas${propertyData.area ? `, ${propertyData.area}m²` : ''}
Valor: R$ ${propertyData.valor?.toLocaleString('pt-BR')}
${propertyData.diferenciais && propertyData.diferenciais.length > 0 ? `Diferenciais: ${propertyData.diferenciais.join(', ')}` : ''}

Descrição do imóvel: ${description}

A copy deve:
- Ser curta e impactante (máximo 150 palavras)
- Usar emojis estrategicamente
- Destacar os principais diferenciais
- Criar senso de urgência
- Incluir call-to-action forte
- Incluir hashtags relevantes (#imoveis #${propertyData.cidade?.toLowerCase()})`;

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) throw new Error('Erro ao gerar copy');

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Erro ao gerar copy:', error);
      return '';
    }
  };

  const handleScan = async () => {
    if (!url.trim()) {
      toast({
        title: 'URL vazia',
        description: 'Digite a URL do imóvel',
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);
    try {
      // Fetch da página
      toast({
        title: 'Escaneando...',
        description: 'Buscando informações do imóvel',
      });

      const response = await fetch(url);
      const html = await response.text();

      // Extrair dados básicos do HTML
      const extractedData = extractPropertyData(html);
      
      // Extrair imagens
      const images = extractImages(html, url);
      
      toast({
        title: 'Analisando com IA...',
        description: 'Processando informações do imóvel',
      });

      // Usar IA para extrair informações mais detalhadas
      const apiKey = localStorage.getItem('mistral_api_key');
      if (apiKey) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const bodyText = (doc.body.innerText || '').slice(0, 3000);

          const extractResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'mistral-small-latest',
              messages: [{
                role: 'user',
                content: `Analise este anúncio de imóvel e extraia APENAS as seguintes informações em formato JSON:
{
  "tipo": "Casa/Apartamento/Terreno/Comercial/Cobertura/Chácara",
  "transacao": "Venda/Aluguel/Temporada",
  "bairro": "nome do bairro",
  "cidade": "nome da cidade",
  "estado": "sigla do estado (ex: SP)",
  "diferenciais": ["lista", "de", "diferenciais"],
  "descricaoAdicional": "breve descrição do imóvel"
}

Texto do anúncio:
${bodyText}

Responda APENAS com o JSON, sem texto adicional.`
              }],
              temperature: 0.3,
              max_tokens: 300,
            }),
          });

          if (extractResponse.ok) {
            const data = await extractResponse.json();
            const content = data.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const aiData = JSON.parse(jsonMatch[0]);
              Object.assign(extractedData, aiData);
            }
          }
        } catch (error) {
          console.error('Erro ao usar IA para extração:', error);
        }
      }

      // Mesclar com valores padrão
      const finalData: PropertyData = {
        tipo: extractedData.tipo || 'Apartamento',
        transacao: extractedData.transacao || 'Venda',
        bairro: extractedData.bairro || '',
        cidade: extractedData.cidade || '',
        estado: extractedData.estado || '',
        quartos: extractedData.quartos || 2,
        banheiros: extractedData.banheiros || 1,
        vagas: extractedData.vagas || 1,
        area: extractedData.area || 50,
        valor: extractedData.valor || 0,
        diferenciais: extractedData.diferenciais || [],
        descricaoAdicional: extractedData.descricaoAdicional || '',
        nomeCorretor: extractedData.nomeCorretor || '',
        telefoneCorretor: extractedData.telefoneCorretor || '',
        creci: extractedData.creci,
        condominio: extractedData.condominio,
        iptu: extractedData.iptu,
        areaTerreno: extractedData.areaTerreno,
      };

      setPropertyData(finalData);

      // Gerar copy com IA
      const copy = await generateCopyWithAI(finalData, html);
      if (copy) {
        setGeneratedCopy(copy);
      }

      // Adicionar imagens aos recursos
      if (images.length > 0) {
        toast({
          title: 'Carregando imagens...',
          description: `${images.length} imagens encontradas`,
        });

        for (const imageUrl of images) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = imageUrl;
            });

            const mediaItem: MediaItem = {
              id: `img-${Date.now()}-${Math.random()}`,
              type: 'image',
              name: `Imagem ${images.indexOf(imageUrl) + 1}`,
              data: imageUrl,
              thumbnail: imageUrl,
            };
            
            addMediaItem(mediaItem);
          } catch (error) {
            console.error('Erro ao carregar imagem:', imageUrl, error);
          }
        }
      }

      toast({
        title: 'Sucesso!',
        description: 'Imóvel escaneado e formulário preenchido',
      });

      // Aguardar um pouco e navegar para o editor
      setTimeout(() => {
        navigate('/editor');
      }, 1500);

    } catch (error) {
      console.error('Erro ao escanear:', error);
      toast({
        title: 'Erro ao escanear',
        description: 'Não foi possível extrair informações da URL',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-4 p-6 bg-card rounded-lg border">
      <h2 className="text-2xl font-bold">Escanear Imóvel</h2>
      <p className="text-sm text-muted-foreground">
        Cole a URL de um anúncio de imóvel para extrair automaticamente todas as informações e imagens
      </p>
      
      <div className="space-y-3">
        <Label>URL do Imóvel</Label>
        <div className="flex gap-2">
          <Input 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.vendebens.com.br/imoveis/..."
            disabled={isScanning}
          />
          <Button 
            onClick={handleScan} 
            disabled={isScanning}
            size="lg"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Escaneando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Escanear
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
