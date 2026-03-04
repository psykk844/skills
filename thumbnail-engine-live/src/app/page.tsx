"use client";

import { useState, useCallback } from 'react';

// Helper function to convert a file to Base64 (returns just the base64 part, not data URL)
const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Extract just the base64 part after "base64,"
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Helper function to fetch a public URL and convert to Base64 (returns just the base64 part)
const fetchToBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Extract just the base64 part after "base64,"
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

// Helper to extract base64 from data URL or fetch from URL
const getBase64FromImageSrc = async (src: string): Promise<string> => {
  // If it's a data URL, extract the base64 part
  if (src.startsWith('data:')) {
    return src.split(',')[1];
  }
  // If it's a URL, fetch and convert to base64
  return await fetchToBase64(src);
};

// Helper to resize image if needed (max 2048px on longest side for optimal API performance)
const resizeImage = (base64: string, maxSize: number = 2048): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      
      // If already small enough, return as-is
      if (width <= maxSize && height <= maxSize) {
        resolve(base64);
        return;
      }
      
      // Calculate new dimensions
      const ratio = Math.min(maxSize / width, maxSize / height);
      const newWidth = Math.round(width * ratio);
      const newHeight = Math.round(height * ratio);
      
      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, newWidth, newHeight);
      
      // Get base64 (without data URL prefix)
      const resized = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      resolve(resized);
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
};

export default function Home() {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [version, setVersion] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [usePresetFace, setUsePresetFace] = useState(true);
  const [selectedPresetFace, setSelectedPresetFace] = useState<string>('face_1.jpg');
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Iteration state
  const [iterationPrompt, setIterationPrompt] = useState<string>('');
  const [iterationHistory, setIterationHistory] = useState<string[]>([]);

  const handleTemplateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTemplateFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        setTemplatePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Reset result when new template is uploaded
      setResultImg(null);
      setIterationHistory([]);
    }
  }, []);

  const handleFaceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFaceFile(file);
      setUsePresetFace(false);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFacePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Get the current face base64
  const getFaceBase64 = async (): Promise<string> => {
    let faceBase64: string;
    if (usePresetFace) {
      faceBase64 = await fetchToBase64(`/${selectedPresetFace}`);
    } else if (faceFile) {
      faceBase64 = await toBase64(faceFile);
    } else {
      throw new Error('No face image selected');
    }
    return await resizeImage(faceBase64);
  };

  const handleGenerate = async () => {
    if (!templateFile) {
      setError('Please upload a thumbnail template first');
      return;
    }

    if (!usePresetFace && !faceFile) {
      setError('Please upload a face photo or select a preset face');
      return;
    }

    setIsLoading(true);
    setResultImg(null);
    setError(null);
    setStatusMessage('Preparing images...');

    try {
      // 1. Convert the user-uploaded template to Base64
      setStatusMessage('Processing template image...');
      let templateBase64 = await toBase64(templateFile);
      templateBase64 = await resizeImage(templateBase64);

      // 2. Get the face image (either from preset or uploaded)
      setStatusMessage('Processing reference photo...');
      const faceBase64 = await getFaceBase64();

      // 3. Send both to our API Route
      setStatusMessage('Generating person swap with Nano Banana 2...');
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateBase64, faceBase64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate thumbnail (${response.status})`);
      }

      const data = await response.json();
      
      // Handle the response
      if (data.imageBase64) {
        const mimeType = data.mimeType || 'image/png';
        const newResultImg = `data:${mimeType};base64,${data.imageBase64}`;
        setResultImg(newResultImg);
        setIterationHistory([newResultImg]);
        setStatusMessage('');
      } else if (data.imageUrl) {
        setResultImg(data.imageUrl);
        setIterationHistory([data.imageUrl]);
        setStatusMessage('');
      } else {
        throw new Error('No image data returned from API');
      }
      
      setVersion((prev) => prev + 1);
      setIterationPrompt('');
    } catch (err: unknown) {
      console.error('Generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error: ${errorMessage}`);
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIterate = async () => {
    if (!resultImg) {
      setError('Generate an image first before iterating');
      return;
    }

    if (!iterationPrompt.trim()) {
      setError('Please enter what you want to change');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusMessage('Processing iteration request...');

    try {
      // Get the current result as base64
      setStatusMessage('Processing current image...');
      const iterationBase64 = await getBase64FromImageSrc(resultImg);

      // Get the face image for reference
      setStatusMessage('Processing reference photo...');
      const faceBase64 = await getFaceBase64();

      // Send iteration request
      setStatusMessage(`Applying changes: "${iterationPrompt}"...`);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          iterationBase64, 
          faceBase64,
          iterationPrompt: iterationPrompt.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to iterate (${response.status})`);
      }

      const data = await response.json();
      
      // Handle the response
      if (data.imageBase64) {
        const mimeType = data.mimeType || 'image/png';
        const newResultImg = `data:${mimeType};base64,${data.imageBase64}`;
        setResultImg(newResultImg);
        setIterationHistory(prev => [...prev, newResultImg]);
        setStatusMessage('');
      } else if (data.imageUrl) {
        setResultImg(data.imageUrl);
        setIterationHistory(prev => [...prev, data.imageUrl]);
        setStatusMessage('');
      } else {
        throw new Error('No image data returned from API');
      }
      
      setVersion((prev) => prev + 1);
      setIterationPrompt('');
    } catch (err: unknown) {
      console.error('Iteration error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error: ${errorMessage}`);
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = () => {
    if (iterationHistory.length > 1) {
      const newHistory = [...iterationHistory];
      newHistory.pop();
      setIterationHistory(newHistory);
      setResultImg(newHistory[newHistory.length - 1]);
      setVersion((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setTemplateFile(null);
    setTemplatePreview(null);
    setFaceFile(null);
    setFacePreview(null);
    setResultImg(null);
    setError(null);
    setUsePresetFace(true);
    setStatusMessage('');
    setIterationPrompt('');
    setIterationHistory([]);
    setVersion(1);
  };

  return (
    <div id="app" className="w-full max-w-7xl mx-auto p-6 md:p-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Nano Banana Pro
          <span className="inline-block bg-gradient-to-r from-[#66fcf1] to-[#45a29e] text-black text-xs md:text-sm px-3 py-1 rounded-full uppercase tracking-widest align-middle ml-2">
            v2.0
          </span>
        </h1>
        <p className="text-[#45a29e] mt-2 text-base md:text-lg">
          AI-Powered YouTube Thumbnail Generator with Person Swap
        </p>
        <div className="mt-3 text-sm text-gray-400">
          Powered by <span className="text-[#66fcf1] font-mono">Nano Banana 2</span> via <span className="text-[#66fcf1] font-mono">fal.ai</span>
        </div>
      </header>

      <main className="container grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

        {/* Left Panel: Controls */}
        <section className="controls glass-panel col-span-1 flex flex-col gap-5">
          <h2 className="text-lg md:text-xl text-white border-b border-gray-600 pb-2 mb-2 font-semibold">
            1. Upload Images
          </h2>

          {/* Template Upload */}
          <div className="upload-group">
            <label className="block text-[#45a29e] text-sm mb-2 font-medium">
              Thumbnail Template <span className="text-red-400">*</span>
            </label>
            <div className="drop-zone relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleTemplateChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {templatePreview ? (
                <div className="flex items-center gap-3">
                  <img 
                    src={templatePreview} 
                    alt="Template preview" 
                    className="w-16 h-10 object-cover rounded"
                  />
                  <span className="text-[#66fcf1] text-sm">Template Ready</span>
                </div>
              ) : (
                <span className="text-gray-300">+ Drop or click to upload template</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The YouTube thumbnail with the person you want to replace
            </p>
          </div>

          {/* Face Selection */}
          <div className="face-selection-group">
            <label className="block text-[#45a29e] text-sm mb-2 font-medium">
              Your Photo <span className="text-red-400">*</span>
            </label>
            
            {/* Toggle between preset and custom */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setUsePresetFace(true)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  usePresetFace 
                    ? 'bg-[#66fcf1]/20 border border-[#66fcf1] text-[#66fcf1]' 
                    : 'bg-black/30 border border-gray-700/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                Preset Photos
              </button>
              <button
                onClick={() => setUsePresetFace(false)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  !usePresetFace 
                    ? 'bg-[#66fcf1]/20 border border-[#66fcf1] text-[#66fcf1]' 
                    : 'bg-black/30 border border-gray-700/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                Upload Custom
              </button>
            </div>

            {usePresetFace ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedPresetFace('face_1.jpg')}
                  className={`flex-1 p-3 rounded-lg border transition-all ${
                    selectedPresetFace === 'face_1.jpg' 
                      ? 'border-[#66fcf1] bg-[#66fcf1]/10' 
                      : 'border-gray-700/50 bg-black/30 hover:border-gray-600'
                  }`}
                >
                  <img 
                    src="/face_1.jpg" 
                    alt="Face 1" 
                    className="w-full h-16 object-cover rounded mb-2"
                  />
                  <div className="text-sm font-medium text-white">Person 1</div>
                </button>
                <button
                  onClick={() => setSelectedPresetFace('face_2.jpg')}
                  className={`flex-1 p-3 rounded-lg border transition-all ${
                    selectedPresetFace === 'face_2.jpg' 
                      ? 'border-[#66fcf1] bg-[#66fcf1]/10' 
                      : 'border-gray-700/50 bg-black/30 hover:border-gray-600'
                  }`}
                >
                  <img 
                    src="/face_2.jpg" 
                    alt="Face 2" 
                    className="w-full h-16 object-cover rounded mb-2"
                  />
                  <div className="text-sm font-medium text-white">Person 2</div>
                </button>
              </div>
            ) : (
              <div className="drop-zone relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFaceChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {facePreview ? (
                  <div className="flex items-center gap-3">
                    <img 
                      src={facePreview} 
                      alt="Face preview" 
                      className="w-12 h-12 object-cover rounded-full"
                    />
                    <span className="text-[#66fcf1] text-sm">Photo Ready</span>
                  </div>
                ) : (
                  <span className="text-gray-300">+ Upload your photo</span>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Best results: Full body or upper body photo with your face, hair, and clothes visible
            </p>
          </div>

          {/* Info Box */}
          <div className="info-box p-3 bg-black/20 rounded-lg border border-gray-700/30">
            <div className="text-xs text-gray-400">
              <span className="text-[#66fcf1] font-semibold">How it works:</span> Nano Banana 2 replaces 
              the entire person in the thumbnail (face, hair, body, clothes) with you from your reference photo,
              while preserving all text, graphics, and background elements.
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm font-medium p-3 bg-red-900/20 rounded-lg border border-red-800/50">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!templateFile || isLoading}
            className="glow-btn"
          >
            {isLoading ? 'Generating...' : resultImg ? 'Regenerate from Template' : `Generate Version ${version}`}
          </button>
        </section>

        {/* Right Panel: Output */}
        <section className="canvas glass-panel col-span-1 lg:col-span-2 flex flex-col h-full">
          <div className="canvas-header flex justify-between items-center mb-4">
            <h2 className="text-lg md:text-xl text-white font-semibold flex-1">Output Canvas</h2>
            <div className="flex items-center gap-2">
              {iterationHistory.length > 1 && (
                <span className="text-gray-400 text-xs">
                  {iterationHistory.length} versions
                </span>
              )}
              <span className="version-tag text-[#66fcf1] bg-[#66fcf1]/10 border border-[#66fcf1]/30 px-3 py-1 rounded-full text-sm">
                {resultImg ? `Version ${version - 1}` : 'Ready'}
              </span>
            </div>
          </div>

          <div className="output-wrapper flex-1 bg-black rounded-xl border border-gray-800 flex items-center justify-center overflow-hidden min-h-[300px] md:min-h-[400px] relative shadow-inner">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="spinner mb-4"></div>
                <p className="text-white font-semibold tracking-wide text-center px-4">
                  {statusMessage || 'Processing with Nano Banana 2...'}
                </p>
                <p className="text-gray-400 text-sm mt-2">This may take 10-30 seconds</p>
              </div>
            )}

            {!isLoading && !resultImg && (
              <div className="placeholder-content flex flex-col items-center text-gray-500 text-center px-4">
                <div className="text-5xl mb-4 opacity-30">🍌</div>
                <p className="text-lg">Ready to generate your thumbnail</p>
                <p className="text-sm mt-2 opacity-70">
                  Upload a template and select a photo to begin
                </p>
              </div>
            )}

            {resultImg && (
              <img 
                src={resultImg} 
                alt="Generated Thumbnail" 
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Iteration Controls - only show when we have a result */}
          {resultImg && !isLoading && (
            <div className="iteration-section mt-4 p-4 bg-black/30 rounded-xl border border-gray-700/50">
              <h3 className="text-sm font-semibold text-[#66fcf1] mb-3">
                Refine Your Thumbnail
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={iterationPrompt}
                  onChange={(e) => setIterationPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleIterate();
                    }
                  }}
                  placeholder="e.g., 'make my expression more excited' or 'fix the hair on the left side'"
                  className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#66fcf1] transition-colors"
                />
                <button
                  onClick={handleIterate}
                  disabled={!iterationPrompt.trim() || isLoading}
                  className="glow-btn !px-6"
                >
                  Apply
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Describe what you want to change. Press Enter or click Apply to iterate.
              </p>
            </div>
          )}

          <div className="iteration-controls flex flex-col sm:flex-row gap-3 mt-4">
            {resultImg && (
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = resultImg;
                  link.download = `nano-banana-thumbnail-v${version-1}-${Date.now()}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="glow-btn !bg-[#45a29e] hover:!bg-[#66fcf1] flex-1"
              >
                Download Thumbnail
              </button>
            )}
            {iterationHistory.length > 1 && (
              <button
                onClick={handleUndo}
                disabled={isLoading}
                className="glow-btn !bg-orange-600 hover:!bg-orange-500 flex-1"
              >
                Undo Last Change
              </button>
            )}
            {resultImg && (
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="glow-btn !bg-purple-600 hover:!bg-purple-500 flex-1"
              >
                Regenerate
              </button>
            )}
            <button 
              onClick={handleReset}
              className="glow-btn !bg-gray-700 hover:!bg-gray-600 flex-1"
            >
              Start Over
            </button>
          </div>
        </section>
      </main>

      <footer className="text-center mt-8 text-gray-500 text-sm">
        <p>Nano Banana Pro v2.0 — Powered by Nano Banana 2 via fal.ai</p>
      </footer>
    </div>
  );
}
