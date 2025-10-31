import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search } from 'lucide-react';
import { usePropertyStore, PropertyData } from '@/store/propertyStore';
import { useEditorStore, MediaItem } from '@/store/editorStore';
import { useNavigate } from 'react-router-dom';

const MISTRAL_API_KEY = 'aynCSftAcQBOlxmtmpJqVzco8K4aaTDQ';

export const PropertyScanner = () => {
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const { setPropertyData, setGeneratedCopy } = usePropertyStore();
  const { addMediaItem } = useEditorStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const extractPropertyDataWithAI = async (html: string): Promise<Partial<PropertyData>> => {
    try {
      // Limitar o tamanho do HTML para não exceder limites da API
      const cleanHtml = html.slice(0, 10000);
      
      const prompt = `Analise o HTML de um anúncio de imóvel e extraia as seguintes informações em formato JSON.
Procure especialmente por elementos como: area útil, quartos, suítes, vagas, banheiros, sacadas, tipo de imóvel, preço, bairro, cidade, estado.

HTML do anúncio:
${cleanHtml}

Responda APENAS com um JSON no seguinte formato (sem texto adicional):
{
  "tipo": "Casa|Apartamento|Terreno|Comercial|Cobertura|Chácara",
  "transacao": "Venda|Aluguel|Temporada",
  "bairro": "nome do bairro",
  "cidade": "nome da cidade", 
  "estado": "sigla (ex: SP)",
  "quartos": numero,
  "banheiros": numero,
  "vagas": numero,
  "area": numero em m²,
  "valor": numero (apenas número sem R$ ou pontos),
  "condominio": numero ou null,
  "iptu": numero ou null,
  "diferenciais": ["lista", "de", "características"],
  "descricaoAdicional": "breve descrição do imóvel"
}`;

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        console.error('Erro na API Mistral:', response.status);
        return {};
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Tentar extrair JSON do conteúdo
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedData = JSON.parse(jsonMatch[0]);
        return extractedData;
      }
      
      return {};
    } catch (error) {
      console.error('Erro ao extrair dados com IA:', error);
      return {};
    }
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

  const generateCopyWithAI = async (propertyData: Partial<PropertyData>) => {
    try {
      const prompt = `Com base nas informações do imóvel abaixo, crie uma copy persuasiva e atraente para um post de rede social (Instagram/TikTok):

Tipo: ${propertyData.tipo || 'Imóvel'}
Transação: ${propertyData.transacao || 'Venda'}
Localização: ${propertyData.bairro}, ${propertyData.cidade}/${propertyData.estado}
Características: ${propertyData.quartos} quartos, ${propertyData.banheiros} banheiros, ${propertyData.vagas} vagas${propertyData.area ? `, ${propertyData.area}m²` : ''}
Valor: R$ ${propertyData.valor?.toLocaleString('pt-BR')}
${propertyData.diferenciais && propertyData.diferenciais.length > 0 ? `Diferenciais: ${propertyData.diferenciais.join(', ')}` : ''}
${propertyData.descricaoAdicional ? `Descrição: ${propertyData.descricaoAdicional}` : ''}

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
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
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
      toast({
        title: 'Escaneando...',
        description: 'Buscando informações do imóvel',
      });

      // Fetch da página usando CORS proxy
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const response = await fetch(proxyUrl + encodeURIComponent(url));
      
      if (!response.ok) {
        throw new Error('Erro ao buscar página');
      }
      
      const html = await response.text();

      toast({
        title: 'Analisando com IA...',
        description: 'Extraindo informações do imóvel com Mistral AI',
      });

      // Usar IA Mistral para extrair informações do HTML
      const extractedData = await extractPropertyDataWithAI(html);
      
      // Extrair imagens
      const images = extractImages(html, url);

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
      toast({
        title: 'Gerando copy...',
        description: 'Criando texto para redes sociais',
      });
      
      const copy = await generateCopyWithAI(finalData);
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
