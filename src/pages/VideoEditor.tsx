import { useState, useRef, useEffect } from "react";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { ResourcePanel } from "@/components/editor/ResourcePanel";
import { VideoPreview } from "@/components/editor/VideoPreview";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { Timeline } from "@/components/editor/Timeline";
import { useEditorStore } from "@/store/editorStore";
import { usePropertyStore } from "@/store/propertyStore";
import { useAutoSave } from "@/hooks/useAutoSave";

const VideoEditor = () => {
  useAutoSave();
  const { updateThumbnailData, thumbnailData } = useEditorStore();
  const { propertyData } = usePropertyStore();
  
  // Sincronizar dados do imóvel com a thumbnail sempre que propertyData mudar
  useEffect(() => {
    if (propertyData && propertyData.cidade) {
      const bedrooms = propertyData.quartos ? `${propertyData.quartos}` : '';
      const bathrooms = propertyData.banheiros ? `${propertyData.banheiros}` : '';
      const area = propertyData.area ? `${propertyData.area}` : '';
      
      // Formatar preço
      let price = '';
      if (propertyData.valor) {
        if (propertyData.transacao === 'Venda') {
          price = `R$ ${propertyData.valor.toLocaleString('pt-BR')}`;
        } else {
          price = `R$ ${propertyData.valor.toLocaleString('pt-BR')}/mês`;
        }
      }
      
      // Formatar localização
      const location = [
        propertyData.bairro,
        propertyData.cidade,
        propertyData.estado
      ].filter(Boolean).join(', ');
      
      // Título baseado no tipo
      const title = `${propertyData.tipo} ${propertyData.transacao === 'Venda' ? 'à Venda' : 'para Alugar'}`;
      
      updateThumbnailData({
        enabled: true,
        title,
        price,
        bedrooms,
        bathrooms,
        area,
        location,
        referencia: propertyData.referencia || ''
      });
    }
  }, [propertyData, updateThumbnailData]);
  
  return (
    <div className="h-screen flex flex-col bg-[hsl(var(--editor-bg))]">
      <EditorHeader />
      
      <div className="flex-1 flex overflow-hidden">
        <ResourcePanel />
        <VideoPreview />
        <PropertiesPanel />
      </div>
      
      <Timeline />
    </div>
  );
};

export default VideoEditor;
