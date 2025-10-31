import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { usePropertyStore, PropertyData } from '@/store/propertyStore';

export const PropertyForm = () => {
  const { propertyData, setPropertyData } = usePropertyStore();
  const [novoDiferencial, setNovoDiferencial] = useState('');

  const updateField = (field: keyof PropertyData, value: any) => {
    setPropertyData({ ...propertyData!, [field]: value });
  };

  const addDiferencial = () => {
    if (novoDiferencial.trim()) {
      updateField('diferenciais', [...(propertyData?.diferenciais || []), novoDiferencial.trim()]);
      setNovoDiferencial('');
    }
  };

  const removeDiferencial = (index: number) => {
    const novos = propertyData?.diferenciais.filter((_, i) => i !== index) || [];
    updateField('diferenciais', novos);
  };

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg border">
      <div>
        <h2 className="text-2xl font-bold mb-4">Informações do Imóvel</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Tipo de Imóvel</Label>
            <Select value={propertyData?.tipo} onValueChange={(v) => updateField('tipo', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Casa">Casa</SelectItem>
                <SelectItem value="Apartamento">Apartamento</SelectItem>
                <SelectItem value="Terreno">Terreno</SelectItem>
                <SelectItem value="Comercial">Comercial</SelectItem>
                <SelectItem value="Cobertura">Cobertura</SelectItem>
                <SelectItem value="Chácara">Chácara</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo de Transação</Label>
            <Select value={propertyData?.transacao} onValueChange={(v) => updateField('transacao', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Venda">Venda</SelectItem>
                <SelectItem value="Aluguel">Aluguel</SelectItem>
                <SelectItem value="Temporada">Temporada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Bairro</Label>
              <Input 
                value={propertyData?.bairro} 
                onChange={(e) => updateField('bairro', e.target.value)}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input 
                value={propertyData?.cidade} 
                onChange={(e) => updateField('cidade', e.target.value)}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Input 
                value={propertyData?.estado} 
                onChange={(e) => updateField('estado', e.target.value)}
                placeholder="UF"
                maxLength={2}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <div>
            <Label>Quartos</Label>
            <Input 
              type="number" 
              value={propertyData?.quartos} 
              onChange={(e) => updateField('quartos', parseInt(e.target.value) || 0)}
              min="0"
            />
          </div>
          <div>
            <Label>Banheiros</Label>
            <Input 
              type="number" 
              value={propertyData?.banheiros} 
              onChange={(e) => updateField('banheiros', parseInt(e.target.value) || 0)}
              min="0"
            />
          </div>
          <div>
            <Label>Vagas</Label>
            <Input 
              type="number" 
              value={propertyData?.vagas} 
              onChange={(e) => updateField('vagas', parseInt(e.target.value) || 0)}
              min="0"
            />
          </div>
          <div>
            <Label>Área (m²)</Label>
            <Input 
              type="number" 
              value={propertyData?.area} 
              onChange={(e) => updateField('area', parseFloat(e.target.value) || 0)}
              min="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <Label>Valor (R$)</Label>
            <Input 
              type="number" 
              value={propertyData?.valor} 
              onChange={(e) => updateField('valor', parseFloat(e.target.value) || 0)}
              min="0"
            />
          </div>
          <div>
            <Label>Condomínio (R$)</Label>
            <Input 
              type="number" 
              value={propertyData?.condominio || ''} 
              onChange={(e) => updateField('condominio', parseFloat(e.target.value) || undefined)}
              min="0"
            />
          </div>
          <div>
            <Label>IPTU (R$)</Label>
            <Input 
              type="number" 
              value={propertyData?.iptu || ''} 
              onChange={(e) => updateField('iptu', parseFloat(e.target.value) || undefined)}
              min="0"
            />
          </div>
        </div>

        <div className="mb-4">
          <Label>Diferenciais</Label>
          <div className="flex gap-2 mb-2">
            <Input 
              value={novoDiferencial}
              onChange={(e) => setNovoDiferencial(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addDiferencial()}
              placeholder="Ex: Piscina, Academia, Varanda gourmet"
            />
            <Button onClick={addDiferencial} type="button">Adicionar</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {propertyData?.diferenciais.map((d, i) => (
              <Badge key={i} variant="secondary" className="flex items-center gap-1">
                {d}
                <X className="w-3 h-3 cursor-pointer" onClick={() => removeDiferencial(i)} />
              </Badge>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <Label>Descrição Adicional</Label>
          <Textarea 
            value={propertyData?.descricaoAdicional}
            onChange={(e) => updateField('descricaoAdicional', e.target.value)}
            placeholder="Informações extras sobre o imóvel..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 border-t pt-4">
          <div>
            <Label>Nome do Corretor</Label>
            <Input 
              value={propertyData?.nomeCorretor}
              onChange={(e) => updateField('nomeCorretor', e.target.value)}
            />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input 
              value={propertyData?.telefoneCorretor}
              onChange={(e) => updateField('telefoneCorretor', e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <Label>CRECI (opcional)</Label>
            <Input 
              value={propertyData?.creci || ''}
              onChange={(e) => updateField('creci', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
