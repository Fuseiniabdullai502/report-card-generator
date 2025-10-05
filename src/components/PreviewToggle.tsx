"use client";

import { useState, useEffect } from "react";
import { FileText, Smartphone } from "lucide-react";

export default function PreviewToggle() {
  const [mode, setMode] = useState<"a4" | "card">("a4");

  useEffect(() => {
    const savedMode = localStorage.getItem("preview-mode") as "a4" | "card" | null;
    if (savedMode) {
      setMode(savedMode);
      document.body.dataset.previewMode = savedMode;
    } else {
      document.body.dataset.previewMode = "a4";
    }
  }, []);

  const toggleMode = () => {
    const newMode = mode === "a4" ? "card" : "a4";
    setMode(newMode);
    localStorage.setItem("preview-mode", newMode);
    document.body.dataset.previewMode = newMode;
  };

  return (
    <div className="flex justify-center mb-4">
      <button
        onClick={toggleMode}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium shadow 
          transition-colors duration-500 ease-in-out
          ${mode === "a4" ? "bg-blue-500 hover:bg-blue-600" : "bg-green-500 hover:bg-green-600"}`}
      >
        {mode === "a4" ? (
          <>
            <FileText size={18} className="animate-fade-in" /> 
            <span className="animate-fade-in">Switch to Card View</span>
          </>
        ) : (
          <>
            <Smartphone size={18} className="animate-fade-in" /> 
            <span className="animate-fade-in">Switch to A4 Preview</span>
          </>
        )}
      </button>
    </div>
  );
}
