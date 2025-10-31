import { create } from 'zustand';

export interface PropertyData {
  // Básico
  tipo: string; // Casa, Apartamento, Terreno, Comercial
  transacao: string; // Venda, Aluguel
  
  // Localização
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  
  // Características
  quartos: number;
  banheiros: number;
  vagas: number;
  area: number;
  areaTerreno?: number;
  
  // Valores
  valor: number;
  condominio?: number;
  iptu?: number;
  
  // Diferenciais
  diferenciais: string[];
  descricaoAdicional: string;
  
  // Corretor
  nomeCorretor: string;
  telefoneCorretor: string;
  creci?: string;
}

interface PropertyState {
  propertyData: PropertyData | null;
  generatedCopy: string;
  
  setPropertyData: (data: PropertyData) => void;
  setGeneratedCopy: (copy: string) => void;
  clearData: () => void;
}

const defaultProperty: PropertyData = {
  tipo: 'Apartamento',
  transacao: 'Venda',
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  quartos: 2,
  banheiros: 1,
  vagas: 1,
  area: 50,
  valor: 0,
  diferenciais: [],
  descricaoAdicional: '',
  nomeCorretor: '',
  telefoneCorretor: '',
};

export const usePropertyStore = create<PropertyState>((set) => {
  // Carregar do localStorage na inicialização
  const loadFromStorage = (): Pick<PropertyState, 'propertyData' | 'generatedCopy'> => {
    try {
      const saved = localStorage.getItem('property-data-storage');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          propertyData: parsed.propertyData || defaultProperty,
          generatedCopy: parsed.generatedCopy || ''
        };
      }
    } catch (e) {
      console.error('Erro ao carregar dados do imóvel:', e);
    }
    return { propertyData: defaultProperty, generatedCopy: '' };
  };

  const initialState = loadFromStorage();

  // Helper para salvar no localStorage
  const saveToStorage = (propertyData: PropertyData | null, generatedCopy: string) => {
    try {
      localStorage.setItem('property-data-storage', JSON.stringify({ propertyData, generatedCopy }));
    } catch (e) {
      console.error('Erro ao salvar dados do imóvel:', e);
    }
  };

  return {
    propertyData: initialState.propertyData,
    generatedCopy: initialState.generatedCopy,
    
    setPropertyData: (data) => {
      set((state) => {
        saveToStorage(data, state.generatedCopy);
        return { propertyData: data };
      });
    },
    
    setGeneratedCopy: (copy) => {
      set((state) => {
        saveToStorage(state.propertyData, copy);
        return { generatedCopy: copy };
      });
    },
    
    clearData: () => {
      saveToStorage(defaultProperty, '');
      set({ propertyData: defaultProperty, generatedCopy: '' });
    },
  };
});
