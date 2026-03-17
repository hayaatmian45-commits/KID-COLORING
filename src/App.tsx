/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
import { 
  Palette, 
  Download, 
  Sparkles, 
  User, 
  BookOpen, 
  Loader2, 
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface ColoringPage {
  id: number;
  imageUrl: string;
  description: string;
}

// --- App Component ---

export default function App() {
  const [theme, setTheme] = useState('');
  const [childName, setChildName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pages, setPages] = useState<ColoringPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'input' | 'generating' | 'result'>('input');

  const generateColoringBook = async () => {
    if (!theme || !childName) return;

    setIsGenerating(true);
    setError(null);
    setPages([]);
    setProgress(0);
    setCurrentStep('generating');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      // Step 1: Generate 5 scene descriptions
      setProgress(10);
      const sceneResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 5 distinct, simple, and fun scene descriptions for a children's coloring book based on the theme: "${theme}". 
        Each scene should be easy to draw as a coloring page. 
        Return the descriptions as a simple list, one per line.`,
      });

      const descriptions = sceneResponse.text?.split('\n').filter(line => line.trim().length > 0).slice(0, 5) || [];
      
      if (descriptions.length < 5) {
        // Fallback if AI doesn't give 5
        const fallbacks = [
          `${theme} scene 1`,
          `${theme} scene 2`,
          `${theme} scene 3`,
          `${theme} scene 4`,
          `${theme} scene 5`,
        ];
        descriptions.push(...fallbacks.slice(descriptions.length));
      }

      const generatedPages: ColoringPage[] = [];

      // Step 2: Generate images for each description
      for (let i = 0; i < 5; i++) {
        const scene = descriptions[i];
        const prompt = `Coloring book page for kids, ${scene}, thick black outlines, white background, no shading, simple shapes, high contrast, professional line art, vector style. The theme is ${theme}.`;
        
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: "3:4",
            },
          },
        });

        let imageUrl = '';
        for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          generatedPages.push({
            id: i + 1,
            imageUrl,
            description: scene
          });
        }
        
        setProgress(20 + (i + 1) * 16); // Progress from 20 to 100
      }

      setPages(generatedPages);
      setCurrentStep('result');
    } catch (err) {
      console.error(err);
      setError('Oops! Something went wrong while generating your coloring book. Please try again.');
      setCurrentStep('input');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // --- Cover Page ---
    doc.setFillColor(250, 250, 245); // Warm off-white
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(40);
    doc.setFont('helvetica', 'bold');
    doc.text(`${childName}'s`, pageWidth / 2, 80, { align: 'center' });
    
    doc.setFontSize(50);
    doc.text("Coloring Book", pageWidth / 2, 105, { align: 'center' });
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'italic');
    doc.text(`Theme: ${theme}`, pageWidth / 2, 130, { align: 'center' });

    // Add a simple border or decoration
    doc.setLineWidth(2);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

    // --- Coloring Pages ---
    for (const page of pages) {
      doc.addPage();
      
      // Add a border for the coloring area
      doc.setLineWidth(0.5);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 40);

      // Add the image
      // We need to handle the image scaling to fit the page
      const imgWidth = pageWidth - 30;
      const imgHeight = (imgWidth * 4) / 3; // Based on 3:4 aspect ratio
      
      doc.addImage(page.imageUrl, 'PNG', 15, 15, imgWidth, imgHeight);

      // Add page description at the bottom
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(page.description, pageWidth / 2, pageHeight - 15, { align: 'center', maxWidth: pageWidth - 40 });
    }

    doc.save(`${childName}_Coloring_Book.pdf`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6">
      <header className="max-w-4xl w-full text-center mb-12">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center p-3 bg-emerald-100 text-emerald-600 rounded-2xl mb-6"
        >
          <Palette size={32} />
        </motion.div>
        <h1 className="text-5xl sm:text-6xl text-stone-900 mb-4 tracking-tight">
          KidColor
        </h1>
        <p className="text-xl text-stone-600 max-w-2xl mx-auto">
          Create a personalized AI-powered coloring book for your little artist in seconds.
        </p>
      </header>

      <main className="max-w-4xl w-full">
        <AnimatePresence mode="wait">
          {currentStep === 'input' && (
            <motion.div
              key="input"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 p-8 border border-stone-100"
            >
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-stone-500 uppercase tracking-wider">
                      <User size={16} />
                      Child's Name
                    </label>
                    <input
                      type="text"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="e.g. Leo"
                      className="w-full px-6 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl transition-all outline-none text-lg font-medium"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-stone-500 uppercase tracking-wider">
                      <Sparkles size={16} />
                      Book Theme
                    </label>
                    <input
                      type="text"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      placeholder="e.g. Space Dinosaurs"
                      className="w-full px-6 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl transition-all outline-none text-lg font-medium"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-3">
                    <RefreshCw size={18} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={generateColoringBook}
                  disabled={!theme || !childName || isGenerating}
                  className={cn(
                    "w-full py-5 rounded-2xl text-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg",
                    theme && childName 
                      ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] shadow-emerald-200" 
                      : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Creating Magic...
                    </>
                  ) : (
                    <>
                      Generate Coloring Book
                      <ChevronRight size={24} />
                    </>
                  )}
                </button>
              </div>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { icon: BookOpen, title: "5 Unique Pages", desc: "Custom scenes based on your theme" },
                  { icon: Printer, title: "Print Ready", desc: "High contrast line art for easy coloring" },
                  { icon: Download, title: "Instant PDF", desc: "Download and print as many as you want" }
                ].map((feature, i) => (
                  <div key={i} className="flex flex-col items-center text-center p-4">
                    <div className="w-12 h-12 bg-stone-50 rounded-full flex items-center justify-center text-stone-400 mb-3">
                      <feature.icon size={24} />
                    </div>
                    <h3 className="font-bold text-stone-800 mb-1">{feature.title}</h3>
                    <p className="text-sm text-stone-500 leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {currentStep === 'generating' && (
            <motion.div
              key="generating"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              className="bg-white rounded-3xl shadow-xl p-12 text-center flex flex-col items-center"
            >
              <div className="relative w-32 h-32 mb-8">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#f5f5f4"
                    strokeWidth="8"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="8"
                    strokeDasharray="283"
                    animate={{ strokeDashoffset: 283 - (283 * progress) / 100 }}
                    transition={{ duration: 0.5 }}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-stone-800">{Math.round(progress)}%</span>
                </div>
              </div>
              <h2 className="text-3xl mb-4">Drawing your book...</h2>
              <p className="text-stone-500 max-w-md mx-auto">
                Gemini is carefully sketching 5 unique scenes for {childName}'s {theme} adventure.
              </p>
              
              <div className="mt-12 w-full max-w-xs space-y-4">
                {[
                  { label: "Brainstorming scenes", min: 10 },
                  { label: "Sketching page 1", min: 36 },
                  { label: "Sketching page 2", min: 52 },
                  { label: "Sketching page 3", min: 68 },
                  { label: "Sketching page 4", min: 84 },
                  { label: "Sketching page 5", min: 100 },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 text-left">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center transition-colors",
                      progress >= step.min ? "bg-emerald-500 text-white" : "bg-stone-100 text-stone-300"
                    )}>
                      {progress >= step.min ? <CheckCircle2 size={12} /> : <div className="w-1.5 h-1.5 bg-current rounded-full" />}
                    </div>
                    <span className={cn(
                      "text-sm font-medium transition-colors",
                      progress >= step.min ? "text-stone-800" : "text-stone-400"
                    )}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {currentStep === 'result' && (
            <motion.div
              key="result"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-stone-100">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
                  <div className="text-center sm:text-left">
                    <h2 className="text-3xl mb-2">Your Book is Ready!</h2>
                    <p className="text-stone-500">5 custom pages generated for {childName}</p>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setCurrentStep('input')}
                      className="px-6 py-3 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw size={18} />
                      Create New
                    </button>
                    <button
                      onClick={downloadPDF}
                      className="px-8 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
                    >
                      <Download size={18} />
                      Download PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Cover Preview */}
                  <div className="coloring-page-preview bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <BookOpen size={48} className="text-stone-300 mb-4 mx-auto" />
                      <h3 className="text-xl font-bold text-stone-800 mb-1">{childName}'s</h3>
                      <p className="text-sm font-medium text-stone-500 uppercase tracking-widest">Cover Page</p>
                    </div>
                  </div>

                  {/* Generated Pages */}
                  {pages.map((page) => (
                    <div key={page.id} className="coloring-page-preview bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden group relative">
                      <img 
                        src={page.imageUrl} 
                        alt={page.description}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover grayscale"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <p className="text-white text-xs font-medium line-clamp-2">{page.description}</p>
                      </div>
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-stone-500 border border-stone-100">
                        PAGE {page.id}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-24 text-stone-400 text-sm flex flex-col items-center gap-4">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> High Quality</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Child Safe</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Print Ready</span>
        </div>
        <p>© 2026 KidColor AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
