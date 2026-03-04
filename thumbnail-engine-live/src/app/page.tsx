"use client";

import { useState } from 'react';

// Helper function to convert a file to Base64
const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Helper function to fetch a public URL and convert to Base64
const fetchToBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
};

export default function Home() {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [version, setVersion] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTemplateFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!templateFile) return;

    setIsLoading(true);
    setResultImg(null);
    setError(null);

    try {
      // 1. Convert the user-uploaded template to Base64
      const templateBase64 = await toBase64(templateFile);

      // 2. Fetch the preset face image from our public folder and convert to Base64
      const faceBase64 = await fetchToBase64('/face_1.jpg');

      // 3. Send both to our secure API Route
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateBase64, faceBase64 }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate thumbnail. Check your API Key.');
      }

      const data = await response.json();
      setResultImg(data.imageUrl);
      setVersion((prev) => prev + 1);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="app" className="w-full max-w-6xl mx-auto p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          Nano Banana Pro <span className="inline-block bg-[#66fcf1] text-black text-sm px-3 py-1 rounded-full uppercase tracking-widest align-middle ml-2">Engine</span>
        </h1>
        <p className="text-[#45a29e] mt-2 text-lg">Next-Gen YouTube Thumbnail Generator</p>
      </header>

      <main className="container grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Panel: Controls */}
        <section className="controls glass-panel col-span-1 flex flex-col gap-6">
          <h2 className="text-xl text-white border-b border-gray-600 pb-2 mb-2 font-semibold">1. Setup Inputs</h2>

          <div className="upload-group">
            <label className="block text-[#45a29e] text-sm mb-2 font-medium">Upload Final Template</label>
            <div className="drop-zone relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className={templateFile ? "text-[#66fcf1]" : "text-gray-300"}>
                {templateFile ? 'Template Selected ✓' : '+ Drag & Drop Template'}
              </span>
            </div>
          </div>

          <div className="input-group">
            <label className="block text-[#45a29e] text-sm mb-2 font-medium">Iteration Prompt</label>
            <textarea
              rows={4}
              placeholder="Face swap is automatic! Describe any other tweaks here..."
              className="w-full bg-black/30 border border-gray-700/50 rounded-lg p-3 text-white focus:outline-none focus:border-[#66fcf1] focus:ring-1 focus:ring-[#66fcf1]"
            />
          </div>

          {error && <div className="text-red-400 text-sm font-semibold p-2 bg-red-900/20 rounded">{error}</div>}

          <button
            onClick={handleGenerate}
            disabled={!templateFile || isLoading}
            className="glow-btn"
          >
            {isLoading ? 'Generating...' : `Generate Version ${version}`}
          </button>
        </section>

        {/* Right Panel: Output */}
        <section className="canvas glass-panel col-span-1 lg:col-span-2 flex flex-col h-full">
          <div className="canvas-header flex justify-between items-center mb-4">
            <h2 className="text-xl text-white font-semibold flex-1">Output Canvas</h2>
            <span className="version-tag text-[#66fcf1] bg-[#66fcf1]/10 border border-[#66fcf1]/30 px-3 py-1 rounded-full text-sm">
              {resultImg ? `Version ${version - 1}` : 'Draft v1'}
            </span>
          </div>

          <div className="output-wrapper flex-1 bg-black rounded-xl border border-gray-800 flex items-center justify-center overflow-hidden min-h-[400px] relative shadow-inner">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="spinner mb-4"></div>
                <p className="text-white font-semibold tracking-wide">Synthesizing real thumbnail via fal.ai...</p>
              </div>
            )}

            {!isLoading && !resultImg && (
              <div className="placeholder-content flex flex-col items-center text-gray-500">
                <p>Ready to generate your stunning thumbnail.</p>
                <p className="text-sm mt-2 opacity-50">(Your face is securely loaded from internal resources)</p>
              </div>
            )}

            {resultImg && (
              <img src={resultImg} alt="Generated Thumbnail" className="w-full h-full object-contain" />
            )}
          </div>

          <div className="iteration-controls flex gap-4 mt-6">
            <input
              type="text"
              placeholder="Change this, change that..."
              className="flex-1 bg-black/30 border border-gray-700/50 rounded-lg p-3 text-white focus:outline-none focus:border-[#66fcf1]"
            />
            <button className="glow-btn !w-auto !px-6 !text-sm">Iterate</button>
          </div>
        </section>
      </main>
    </div>
  );
}
