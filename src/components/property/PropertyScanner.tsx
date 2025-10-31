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
  const { addMediaItem, addClip, updateTotalDuration } = useEditorStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const extractPropertyDataFromHTML = (html: string): Partial<PropertyData> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const data: Partial<PropertyData> = {
      diferenciais: [],
      descricaoAdicional: ''
    };

    // Procurar por .sub-details .detail e extrair valores
    const detailElements = doc.querySelectorAll('.sub-details .detail, .detail');
    
    detailElements.forEach((detail) => {
      const labelDiv = detail.querySelector('div:nth-child(2)');
      const valueDiv = detail.querySelector('div.value, .value');
      
      if (!labelDiv || !valueDiv) return;
      
      const label = labelDiv.textContent?.trim().toLowerCase() || '';
      const valueText = valueDiv.textContent?.trim() || '';
      
      // Extrair número do texto
      const numberMatch = valueText.match(/(\d+(?:[.,]\d+)?)/);
      const number = numberMatch ? parseFloat(numberMatch[1].replace(',', '.')) : 0;
      
      // Mapear labels para campos
      if (label.includes('quarto') || label.includes('dormitório')) {
        data.quartos = number;
      } else if (label.includes('banheiro') || label.includes('wc')) {
        data.banheiros = number;
      } else if (label.includes('vaga') || label.includes('garagem')) {
        data.vagas = number;
      } else if (label.includes('área') || label.includes('area')) {
        data.area = number;
      } else if (label.includes('suíte') || label.includes('suite')) {
        if (!data.diferenciais) data.diferenciais = [];
        data.diferenciais.push(`${number} suíte${number > 1 ? 's' : ''}`);
      } else if (label.includes('sacada') || label.includes('varanda')) {
        if (!data.diferenciais) data.diferenciais = [];
        data.diferenciais.push('Sacada');
      }
    });

    // Extrair preço
    const priceElements = doc.querySelectorAll('.price, .valor, .preco, [class*="price"], [class*="valor"]');
    for (const priceEl of priceElements) {
      const priceText = priceEl.textContent || '';
      const priceMatch = priceText.match(/R\$\s*([\d.,]+)/);
      if (priceMatch) {
        data.valor = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
        break;
      }
    }

    // Extrair endereço/localização
    const locationElements = doc.querySelectorAll('.location, .endereco, .address, [class*="location"], [class*="endereco"]');
    for (const locEl of locationElements) {
      const locText = locEl.textContent?.trim() || '';
      
      // Tentar extrair bairro, cidade, estado
      const parts = locText.split(/[,-]/);
      if (parts.length >= 2) {
        data.bairro = parts[0]?.trim() || '';
        data.cidade = parts[1]?.trim() || '';
        if (parts.length >= 3) {
          data.estado = parts[2]?.trim().toUpperCase().slice(0, 2) || '';
        }
      }
      break;
    }

    // Extrair tipo de imóvel do título ou classe
    const titleElements = doc.querySelectorAll('h1, h2, .title, .titulo, [class*="title"]');
    for (const titleEl of titleElements) {
      const titleText = titleEl.textContent?.toLowerCase() || '';
      if (titleText.includes('apartamento')) data.tipo = 'Apartamento';
      else if (titleText.includes('casa')) data.tipo = 'Casa';
      else if (titleText.includes('cobertura')) data.tipo = 'Cobertura';
      else if (titleText.includes('terreno')) data.tipo = 'Terreno';
      else if (titleText.includes('comercial') || titleText.includes('sala')) data.tipo = 'Comercial';
      else if (titleText.includes('chácara') || titleText.includes('chacara')) data.tipo = 'Chácara';
      
      if (data.tipo) break;
    }

    // Extrair descrição
    const descElements = doc.querySelectorAll('.description, .descricao, [class*="description"], [class*="descricao"]');
    if (descElements.length > 0) {
      data.descricaoAdicional = descElements[0].textContent?.trim().slice(0, 200) || '';
    }

    return data;
  };

  const extractImages = (html: string, baseUrl: string): string[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images: string[] = [];
    
    // Procurar imagens na classe específica property-view--slides-inner
    const slidesContainer = doc.querySelector('.property-view--slides-inner');
    if (slidesContainer) {
      const imgElements = slidesContainer.querySelectorAll('img');
      imgElements.forEach(img => {
        const imgEl = img as HTMLImageElement;
        let src = imgEl.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (src) {
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
    }
    
    // Fallback: procurar em outras classes comuns de galeria se não encontrou nada
    if (images.length === 0) {
      const gallerySelectors = [
        '.gallery img',
        '.carousel img',
        '.slides img',
        '.photos img',
        '.images img',
        '[class*="slide"] img',
        '[class*="gallery"] img'
      ];
      
      for (const selector of gallerySelectors) {
        const imgElements = doc.querySelectorAll(selector);
        imgElements.forEach(img => {
          const imgEl = img as HTMLImageElement;
          let src = imgEl.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
          if (src && !src.includes('logo') && !src.includes('icon')) {
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
        
        if (images.length > 0) break;
      }
    }
    
    return images.slice(0, 20); // Limitar a 20 imagens
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
      const cidade = propertyData.cidade || '';
      const bairro = propertyData.bairro || '';
      const tipo = propertyData.tipo || 'Imóvel';
      const transacao = propertyData.transacao || 'Venda';
      const valor = propertyData.valor
        ? `por R$ ${propertyData.valor.toLocaleString('pt-BR')}`
        : '';
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

      const fallback = `✨ ${tipo} para ${transacao} em ${bairro} · ${cidade}\n\n${caracts}${valor ? ` \u2014 ${valor}` : ''}\n${difs}\nCorra! Oportunidade única com excelente localização. Fale agora e agende sua visita! 📲\n\n#imoveis #${cidade.toLowerCase()}`;
      return fallback;
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
        title: 'Extraindo dados...',
        description: 'Lendo informações do imóvel',
      });

      // Extrair dados diretamente do HTML (rápido)
      const extractedData = extractPropertyDataFromHTML(html);
      
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

      // Adicionar imagens aos recursos e à timeline
      if (images.length > 0) {
        toast({
          title: 'Carregando imagens...',
          description: `${images.length} imagens encontradas`,
        });

        const createdMedia: MediaItem[] = [];

        // Carregar todas as imagens como HTMLImageElement
        const loadPromises = images.map((imageUrl, index) => {
          return new Promise<MediaItem>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              const mediaItem: MediaItem = {
                id: `img-${Date.now()}-${Math.random()}-${index}`,
                type: 'image',
                name: `Imagem ${index + 1}`,
                data: img, // HTMLImageElement carregado!
                thumbnail: imageUrl,
              };
              resolve(mediaItem);
            };
            
            img.onerror = () => {
              // Fallback: usar URL diretamente se CORS falhar
              console.warn('Erro ao carregar imagem com CORS, usando URL direta:', imageUrl);
              const mediaItem: MediaItem = {
                id: `img-${Date.now()}-${Math.random()}-${index}`,
                type: 'image',
                name: `Imagem ${index + 1}`,
                data: imageUrl,
                thumbnail: imageUrl,
              };
              resolve(mediaItem);
            };
            
            img.src = imageUrl;
          });
        });

        try {
          const loadedMedia = await Promise.all(loadPromises);
          
          loadedMedia.forEach(mediaItem => {
            createdMedia.push(mediaItem);
            addMediaItem(mediaItem);
          });

          // Inserir automaticamente na timeline (track V1)
          const editorState = useEditorStore.getState();
          const defaultDur = editorState.globalSettings?.defaultImageDuration ?? 3000;
          // Começar após o final atual da timeline
          const baseStart =
            editorState.clips.length > 0
              ? Math.max(...editorState.clips.map(c => c.start + c.duration))
              : 0;

          let start = baseStart;
          createdMedia.forEach((mi) => {
            const clipId = `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            addClip({
              id: clipId,
              type: 'image',
              mediaId: mi.id,
              track: 'V1',
              start,
              duration: defaultDur,
              scale: 1.0,
              brightness: 0,
              contrast: 0,
              volume: 1.0,
              speed: 1.0,
              opacity: 1.0,
              transition: 'cross-fade',
              transitionDuration: 500,
            });
            start += defaultDur;
          });

          updateTotalDuration();

          toast({
            title: 'Sucesso!',
            description: `${createdMedia.length} imagens adicionadas à timeline`,
          });
        } catch (error) {
          console.error('Erro ao carregar imagens:', error);
          toast({
            title: 'Erro',
            description: 'Algumas imagens não puderam ser carregadas',
            variant: 'destructive',
          });
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
