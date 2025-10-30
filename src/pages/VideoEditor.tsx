import { useState, useRef, useEffect } from "react";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { ResourcePanel } from "@/components/editor/ResourcePanel";
import { VideoPreview } from "@/components/editor/VideoPreview";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { Timeline } from "@/components/editor/Timeline";
import { useEditorStore } from "@/store/editorStore";

const VideoEditor = () => {
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
