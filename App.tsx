
import React, { useState, useMemo, useEffect } from 'react';
import ControlCenter from './components/ControlCenter';
import Workspace from './components/Workspace';
import ContextualPanel from './components/ContextualPanel';
import { WorkMode, TextOverlay, ApiKey } from './types';
import { generateImageWithGemini, validateApiKey, QuotaExceededError } from './services/geminiService';
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

  // State for Identity Lock/Masking feature
  const [isMasking, setIsMasking] = useState(false);
  const [identityMask, setIdentityMask] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(40);

  // State for Text Overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [activeTextOverlayId, setActiveTextOverlayId] = useState<string | null>(null);

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
  
  const activeApiKey = useMemo(() => apiKeys.find(k => k.isActive)?.key || null, [apiKeys]);

  const updateApiKeysInStateAndStorage = (newKeys: ApiKey[]) => {
      setApiKeys(newKeys);
      localStorage.setItem('gemini-api-keys', JSON.stringify(newKeys));
  };

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
    if (!image) return;

    let currentApiKeysState = [...apiKeys];
    const initialActiveKey = currentApiKeysState.find(k => k.isActive && k.status === 'valid');
    
    const validKeys = currentApiKeysState.filter(k => k.status === 'valid');
    if (validKeys.length === 0) {
        alert("Vui lòng thêm và chọn một API Key hợp lệ trước khi tạo ảnh.");
        return;
    }

    const startIndex = initialActiveKey ? validKeys.findIndex(k => k.key === initialActiveKey.key) : 0;
    const orderedKeysToTry = startIndex !== -1 ? [...validKeys.slice(startIndex), ...validKeys.slice(0, startIndex)] : validKeys;

    setIsLoading(true);
    setResultImage(null);

    let generatedImage: string | null = null;
    let successfulKey: ApiKey | null = null;

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
            break; // Success! Exit the loop.
        } catch (error) {
            if (error instanceof QuotaExceededError) {
                console.warn(`API Key ${keyToTry.key.substring(0,8)}... exceeded quota. Trying next key.`);
                currentApiKeysState = currentApiKeysState.map(k => 
                    k.key === keyToTry.key ? { ...k, status: 'invalid', isActive: false } : k
                );
            } else {
                alert(`Đã xảy ra lỗi khi gọi API Gemini: ${error instanceof Error ? error.message : String(error)}`);
                generatedImage = null;
                break; // Exit loop on non-quota error
            }
        }
    }

    setIsLoading(false);

    if (generatedImage && successfulKey) {
        setResultImage(generatedImage);
        currentApiKeysState = currentApiKeysState.map(k => ({...k, isActive: k.key === successfulKey!.key}));
    } else {
        const remainingValidKeys = currentApiKeysState.filter(k => k.status === 'valid');
        if (remainingValidKeys.length === 0 && validKeys.length > 0) {
            alert("Tất cả API Key hợp lệ đã hết quota. Vui lòng thêm API Key mới.");
        }
    }
    
    updateApiKeysInStateAndStorage(currentApiKeysState);
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
  const handleAddApiKeys = async (keysString: string) => {
    const newKeyStrings = keysString.split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .filter(k => !apiKeys.some(existingKey => existingKey.key === k));

    if (newKeyStrings.length === 0) {
      alert("Không có key mới nào được thêm. Key có thể đã tồn tại hoặc bạn chưa nhập key nào.");
      return;
    }

    const newKeyEntries: ApiKey[] = newKeyStrings.map(key => ({ key, status: 'checking', isActive: false }));
    
    const tempKeys = [...apiKeys, ...newKeyEntries];
    setApiKeys(tempKeys);

    const validationPromises = newKeyStrings.map(key => validateApiKey(key).then(isValid => ({ key, isValid })));
    const results = await Promise.allSettled(validationPromises);

    let finalKeys = [...tempKeys];
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            const { key, isValid } = result.value;
            finalKeys = finalKeys.map(k => k.key === key ? { ...k, status: isValid ? 'valid' : 'invalid' } : k);
        } else {
            // Handle promise rejection if needed, e.g., network error during validation
             const failedKey = (result.reason as any)?.key; // This depends on how you'd pass the key on failure
             if (failedKey) {
                finalKeys = finalKeys.map(k => k.key === failedKey ? { ...k, status: 'invalid' } : k);
             }
        }
    });

    const hasActiveKey = finalKeys.some(k => k.isActive && k.status === 'valid');
    if (!hasActiveKey) {
        // Find the first newly added key that is valid and activate it
        const firstNewValidKey = finalKeys.find(k => newKeyStrings.includes(k.key) && k.status === 'valid');
        if (firstNewValidKey) {
            // Deactivate all others and activate the new one
            finalKeys = finalKeys.map(k => ({ ...k, isActive: k.key === firstNewValidKey.key }));
        } else {
            // If no new keys are valid, but old valid keys exist, activate the first old valid one
            const anyOldValidKey = finalKeys.find(k => k.status === 'valid');
            if(anyOldValidKey) {
                 finalKeys = finalKeys.map(k => ({ ...k, isActive: k.key === anyOldValidKey.key }));
            }
        }
    }

    updateApiKeysInStateAndStorage(finalKeys);
  };

  const handleRemoveApiKey = (keyToRemove: string) => {
    const wasActive = apiKeys.find(k => k.key === keyToRemove)?.isActive;
    let newKeys = apiKeys.filter(k => k.key !== keyToRemove);
    
    if (wasActive && newKeys.length > 0) {
        const firstValidIndex = newKeys.findIndex(k => k.status === 'valid');
        if (firstValidIndex > -1) {
            newKeys[firstValidIndex].isActive = true;
        } else if (newKeys.length > 0) {
            // if no valid keys left, try to activate any other key.
            // This case is unlikely if we only allow activating valid keys.
            // But as a fallback, just activate the first one.
            newKeys[0].isActive = true; 
        }
    }
    updateApiKeysInStateAndStorage(newKeys);
  };

  const handleSetActiveApiKey = (keyToActivate: string) => {
    const keyToUpdate = apiKeys.find(k => k.key === keyToActivate);
    if (keyToUpdate && keyToUpdate.status !== 'valid') {
        alert("Chỉ có thể kích hoạt API Key hợp lệ.");
        return;
    }
    const newKeys = apiKeys.map(k => ({
      ...k,
      isActive: k.key === keyToActivate,
    }));
    updateApiKeysInStateAndStorage(newKeys);
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
