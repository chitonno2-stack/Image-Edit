
import React, { useState, useMemo, useEffect } from 'react';
import ControlCenter from './components/ControlCenter';
import Workspace from './components/Workspace';
import ContextualPanel from './components/ContextualPanel';
import { WorkMode, TextOverlay, ApiKey } from './types';
import { generateImageWithGemini, QuotaExceededError, AuthenticationError } from './services/geminiService';
import { flattenTextOverlays } from './services/imageUtils';
import ApiKeyModal from './components/ApiKeyModal';

const initialSettings = {
  [WorkMode.PORTRAIT]: {
    // 2. Identity & Detail Engine
    targetResolution: '8K',
    autoSkinTexture: true,
    autoHairDetail: true,

    // 3. Dynamic Studio Relighting
    autoBalanceLighting: true,
    lightStyle: '3-point', // '3-point', 'rim', 'butterfly'
    lightIntensity: 70,

    // 4. Professional Lens FX
    autoBokeh: true,
    lensProfile: '85mm f/1.4', // '85mm f/1.4', '50mm f/1.8', '35mm f/2'
    backgroundBlur: 80,
    chromaticAberration: false,

    // 5. Beauty & Style
    skinSmoothing: 40,
    removeBlemishes: true,
    removeWrinkles: false,
    removeDarkCircles: true,
    makeup: '',
    hair: '',
  },
  [WorkMode.RESTORE]: {
    // Step 1: Clean
    autoClean: true,
    // Step 2: Remaster
    hyperRealSkin: true,
    hairAndFabricDetails: true,
    resolution: '4K',
    // Step 3: Studio Finish
    autoStudioLight: true,
    lightStyle: '3-point',
    modernAutoColor: true,
    autoWhiteBalance: true,
    backgroundProcessing: 'remaster',
    studioBackdrop: 'grey',
    // Context
    context: '',
  },
  [WorkMode.CREATIVE]: {
    // Workflow 1: Studio Swap
    subjectIsolated: false,
    backgroundPrompt: '',

    // Workflow 2: Full-Body Generation
    fullBodyPrompt: '',
  },
  [WorkMode.COMPOSITE]: {
    lightMatch: 85,
    colorTempMatch: 90,
    smartShadows: true,
    grainMatch: true,
    focusMatch: true,
    perspectiveMatch: true,
  },
};


const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<WorkMode>(WorkMode.PORTRAIT);
  const [image, setImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [settings, setSettings] = useState<typeof initialSettings>(initialSettings);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  // State for Identity Lock/Masking feature
  const [isMasking, setIsMasking] = useState(false);
  const [identityMask, setIdentityMask] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(40);

  // State for Text Overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [activeTextOverlayId, setActiveTextOverlayId] = useState<string | null>(null);

  // Load keys from localStorage on initial mount
  useEffect(() => {
    try {
      const storedKeys = localStorage.getItem('gemini-api-keys');
      if (storedKeys) {
        setApiKeys(JSON.parse(storedKeys));
      }
    } catch (error) {
      console.error("Failed to parse API keys from localStorage", error);
      localStorage.removeItem('gemini-api-keys');
    }
  }, []);
  
  // Persist keys to localStorage whenever they change
  useEffect(() => {
    // Don't save during the initial empty state on mount
    if (apiKeys.length > 0 || localStorage.getItem('gemini-api-keys')) {
       localStorage.setItem('gemini-api-keys', JSON.stringify(apiKeys));
    }
  }, [apiKeys]);
  
  const activeApiKey = useMemo(() => apiKeys.find(k => k.isActive)?.key || null, [apiKeys]);

  const activeSettings = useMemo(() => settings[activeMode], [settings, activeMode]);

  const handleSettingsChange = (newSettings: Partial<typeof activeSettings>) => {
    setSettings(prev => ({
      ...prev,
      [activeMode]: {
        ...prev[activeMode],
        ...newSettings,
      },
    }));
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageData = reader.result as string;
      setImage(imageData);
      setHistory([imageData]);
      setHistoryIndex(0);
      setResultImage(null);
      setIdentityMask(null); // Clear mask on new image
      setIsMasking(false);
      setTextOverlays([]); // Clear text overlays on new image
      setActiveTextOverlayId(null);
    };
    reader.readAsDataURL(file);
  };
  
  const handleClearImage = () => {
    setImage(null);
    setHistory([]);
    setHistoryIndex(-1);
    setResultImage(null);
    setBackgroundImage(null);
    setReferenceImage(null);
    setIdentityMask(null);
    setIsMasking(false);
    setTextOverlays([]);
    setActiveTextOverlayId(null);
  };

  const handleBackgroundImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setBackgroundImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleReferenceImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  const handleGenerate = async (prompt: string) => {
    if (!image || isCoolingDown) return;

    const usableKeys = apiKeys.filter(k => k.status !== 'invalid');
    if (usableKeys.length === 0) {
        alert("Vui lòng thêm một API Key hợp lệ trước khi tạo ảnh.");
        return;
    }

    // Smartly order keys to try, starting with the active one
    const activeKey = usableKeys.find(k => k.isActive);
    const startIndex = activeKey ? usableKeys.findIndex(k => k.key === activeKey.key) : 0;
    const orderedKeysToTry = startIndex !== -1 
        ? [...usableKeys.slice(startIndex), ...usableKeys.slice(0, startIndex)] 
        : usableKeys;

    setIsLoading(true);
    setResultImage(null);

    let generatedImage: string | null = null;
    let successfulKey: ApiKey | null = null;
    let hadQuotaError = false; // Track if we encountered any 429 error

    const imageWithText = textOverlays.length > 0
        ? await flattenTextOverlays(image, textOverlays)
        : image;
    const mimeType = imageWithText.substring(imageWithText.indexOf(':') + 1, imageWithText.indexOf(';'));

    for (const keyToTry of orderedKeysToTry) {
        try {
            console.log(`Attempting generation with key: ${keyToTry.key.substring(0, 8)}...`);
            const result = await generateImageWithGemini({
                apiKey: keyToTry.key,
                base64Image: imageWithText,
                base64BackgroundImage: activeMode === WorkMode.COMPOSITE ? backgroundImage : undefined,
                base64ReferenceImage: activeMode === WorkMode.CREATIVE ? referenceImage : undefined,
                base64Mask: activeMode === WorkMode.CREATIVE && isMasking ? identityMask : undefined,
                mimeType,
                prompt,
                mode: activeMode,
                settings: activeSettings,
            });
            generatedImage = result;
            successfulKey = keyToTry;
            
            // LAZY VALIDATION: If the key worked, mark it as 'valid' if it was 'unknown'
            if (keyToTry.status === 'unknown') {
                setApiKeys(prev => prev.map(k => k.key === keyToTry.key ? {...k, status: 'valid'} : k));
            }

            break; // Success! Exit the loop.
        } catch (error) {
            if (error instanceof AuthenticationError) {
                console.error(`API Key ${keyToTry.key.substring(0,8)}... is invalid. Marking as invalid.`);
                setApiKeys(prev => prev.map(k => k.key === keyToTry.key ? {...k, status: 'invalid'} : k));
                // Continue to the next key, don't alert the user yet
            } else if (error instanceof QuotaExceededError) {
                console.warn(`API Key ${keyToTry.key.substring(0,8)}... hit a rate limit. Trying next key.`);
                hadQuotaError = true;
                // Continue to the next key
            } else {
                alert(`Đã xảy ra lỗi không mong muốn khi gọi API: ${error instanceof Error ? error.message : String(error)}`);
                generatedImage = null; // Ensure we don't proceed
                break; // Exit loop on non-quota, hard errors
            }
        }
    }

    setIsLoading(false);

    if (generatedImage && successfulKey) {
        setResultImage(generatedImage);
        // If the successful key wasn't the active one, update the active status.
        if (!successfulKey.isActive) {
            handleSetActiveApiKey(successfulKey.key);
        }
    } else if (hadQuotaError) {
        // This is only reached if all usable keys failed, and at least one was a quota error.
        alert("Tất cả API Key hiện tại đều đã đạt đến giới hạn yêu cầu (rate-limited). Vui lòng đợi một lát rồi thử lại hoặc thêm key mới. Ứng dụng sẽ tạm dừng trong 60 giây.");
        setIsCoolingDown(true);
        setTimeout(() => setIsCoolingDown(false), 60000); // 60-second cooldown
    } else if (!generatedImage) {
        // This is reached if all keys were tried and failed (e.g., all were marked invalid)
        const stillUsableKeys = apiKeys.filter(k => k.status !== 'invalid');
        if(stillUsableKeys.length === 0) {
            alert("Tất cả API Key của bạn đã được xác định là không hợp lệ. Vui lòng thêm key mới.");
        }
    }
  };


  const handleModeChange = (mode: WorkMode) => {
    if (mode !== WorkMode.COMPOSITE) {
      setBackgroundImage(null);
    }
    if (mode !== WorkMode.CREATIVE) {
        setReferenceImage(null);
        setIdentityMask(null);
        setIsMasking(false);
    }
    // Reset creative mode workflow states when switching to it
    if (mode === WorkMode.CREATIVE) {
        handleSettingsChange(initialSettings[WorkMode.CREATIVE]);
    }
    setActiveMode(mode);
  }

  const handleCommitResult = () => {
    if (resultImage) {
      // If we've undone and are now making a new edit, discard the "redo" history.
      const newHistory = history.slice(0, historyIndex + 1);
      
      const updatedHistory = [...newHistory, resultImage];
      setHistory(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
      setImage(resultImage);   // Promote result image to main image
      setResultImage(null);    // Clear the result pane
      setIdentityMask(null);   // Clear the mask after commit as it applies to the old image
      setIsMasking(false);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setImage(history[newIndex]);
      setResultImage(null);   // Clear any pending result when undoing
      setIdentityMask(null);
      setIsMasking(false);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setImage(history[newIndex]);
      setResultImage(null); // Clear any pending result when redoing
      setIdentityMask(null);
      setIsMasking(false);
    }
  };
  
  // --- Text Overlay Handlers ---
  const handleAddText = () => {
    const newText: TextOverlay = {
      id: `text-${Date.now()}`,
      text: 'Nhập văn bản',
      fontFamily: 'Arial',
      fontSize: 5, // 5% of image height
      color: '#FFFFFF',
      textAlign: 'center',
      x: 50,
      y: 50,
    };
    setTextOverlays(prev => [...prev, newText]);
    setActiveTextOverlayId(newText.id);
  };

  const handleUpdateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev => prev.map(overlay => 
      overlay.id === id ? { ...overlay, ...updates } : overlay
    ));
  };

  const handleDeleteTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(overlay => overlay.id !== id));
    if (activeTextOverlayId === id) {
      setActiveTextOverlayId(null);
    }
  };

  // --- API Key Handlers ---
  const handleAddApiKeys = (keysString: string) => {
    const newKeyStrings = keysString.split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0);

    setApiKeys(prevKeys => {
        const existingKeys = new Set(prevKeys.map(k => k.key));
        const uniqueNewKeys = newKeyStrings.filter(k => !existingKeys.has(k));

        if (uniqueNewKeys.length === 0) {
            alert("Không có key mới nào được thêm. Key có thể đã tồn tại hoặc bạn chưa nhập key nào.");
            return prevKeys;
        }

        const newKeyEntries: ApiKey[] = uniqueNewKeys.map(key => ({ 
            key, 
            status: 'unknown', // Add as 'unknown' and validate on first use.
            isActive: false 
        }));

        const combinedKeys = [...prevKeys, ...newKeyEntries];

        // If there was no active key before, make the first new key active.
        const hasActiveKey = combinedKeys.some(k => k.isActive);
        if (!hasActiveKey && combinedKeys.length > 0) {
            const firstKeyToActivate = combinedKeys.find(k => k.status !== 'invalid');
            if(firstKeyToActivate) {
                return combinedKeys.map(k => ({...k, isActive: k.key === firstKeyToActivate.key}));
            }
        }
        return combinedKeys;
    });
  };


  const handleRemoveApiKey = (keyToRemove: string) => {
    setApiKeys(prevKeys => {
        const keyBeingRemoved = prevKeys.find(k => k.key === keyToRemove);
        let newKeys = prevKeys.filter(k => k.key !== keyToRemove);
        
        // If the removed key was active, we need to activate a new one.
        if (keyBeingRemoved?.isActive && newKeys.length > 0) {
            // Find the first non-invalid key to make active.
            const firstUsable = newKeys.find(k => k.status !== 'invalid');
            if (firstUsable) {
                newKeys = newKeys.map(k => ({...k, isActive: k.key === firstUsable.key}));
            } else {
                // If no usable keys are left, just make the first one active.
                newKeys[0].isActive = true;
            }
        }
        return newKeys;
    });
  };

  const handleSetActiveApiKey = (keyToActivate: string) => {
    setApiKeys(prevKeys => {
        const keyToUpdate = prevKeys.find(k => k.key === keyToActivate);
        // Allow activating 'unknown' keys, as they haven't been proven invalid.
        if (keyToUpdate && keyToUpdate.status === 'invalid') {
            alert("Không thể kích hoạt API Key đã được xác định là không hợp lệ.");
            return prevKeys; // Return original state if invalid
        }
        return prevKeys.map(k => ({
            ...k,
            isActive: k.key === keyToActivate,
        }));
    });
  };


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="flex h-screen w-screen bg-gray-800/50">
      <aside className="w-80 flex flex-col bg-gray-900 border-r border-gray-700/50">
        <ControlCenter 
          activeMode={activeMode} 
          setActiveMode={handleModeChange}
        />
        <ContextualPanel 
          activeMode={activeMode} 
          settings={activeSettings}
          onSettingsChange={handleSettingsChange}
          onBackgroundImageUpload={handleBackgroundImageUpload}
          backgroundImage={backgroundImage}
          onReferenceImageUpload={handleReferenceImageUpload}
          referenceImage={referenceImage}
          isCollapsed={isPanelCollapsed}
          onToggleCollapse={() => setIsPanelCollapsed(p => !p)}
          onGenerate={handleGenerate}
          isApiKeySet={!!activeApiKey}
          isCoolingDown={isCoolingDown}
          // Masking props for Creative Panel
          isMasking={isMasking}
          onToggleMasking={() => setIsMasking(p => !p)}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
        />
      </aside>
      <main className="flex-1 flex flex-col p-4 gap-4">
        <Workspace 
          activeMode={activeMode}
          originalImage={image}
          resultImage={resultImage}
          backgroundImage={backgroundImage}
          onImageUpload={handleImageUpload}
          onClearImage={handleClearImage}
          isLoading={isLoading}
          onGenerate={handleGenerate}
          onCommitResult={handleCommitResult}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          isApiKeySet={!!activeApiKey}
          isCoolingDown={isCoolingDown}
          onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          // Masking props for Workspace
          isMasking={isMasking}
          identityMask={identityMask}
          onMaskChange={setIdentityMask}
          brushSize={brushSize}
          // Text Overlay props
          textOverlays={textOverlays}
          activeTextOverlayId={activeTextOverlayId}
          onAddText={handleAddText}
          onUpdateTextOverlay={handleUpdateTextOverlay}
          onDeleteTextOverlay={handleDeleteTextOverlay}
          onSelectTextOverlay={setActiveTextOverlayId}
        />
      </main>
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKeys={apiKeys}
        onAddKeys={handleAddApiKeys}
        onRemoveKey={handleRemoveApiKey}
        onSetActiveKey={handleSetActiveApiKey}
      />
    </div>
  );
};

export default App;
