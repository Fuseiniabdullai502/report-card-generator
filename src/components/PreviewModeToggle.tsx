
"use client";

import { useState, useEffect } from "react";
import { FileText, Smartphone } from "lucide-react";

export default function PreviewModeToggle() {
  const [mode, setMode] = useState<"a4" | "card">("a4");
  const [mounted, setMounted] = useState(false);

  // Safely access localStorage only on the client side after mounting.
  useEffect(() => {
    setMounted(true);
    try {
      const savedMode = localStorage.getItem("preview-mode") as "a4" | "card" | null;
      const initialMode = savedMode || "a4";
      setMode(initialMode);
      document.body.dataset.previewMode = initialMode;
    } catch (e) {
      console.error("Could not access localStorage for preview mode.", e);
      // Fallback to default if localStorage is unavailable
      document.body.dataset.previewMode = "a4";
    }
  }, []);

  const toggleMode = () => {
    const newMode = mode === "a4" ? "card" : "a4";
    setMode(newMode);
    try {
      localStorage.setItem("preview-mode", newMode);
      document.body.dataset.previewMode = newMode;
    } catch (e) {
        console.error("Could not save preview mode to localStorage.", e);
    }
  };

  if (!mounted) {
    // Render a placeholder or null on the server to prevent hydration mismatch.
    return (
       <div className="flex justify-center items-center gap-3 mb-4 h-6 w-32">
        {/* Skeleton loader can be added here */}
       </div>
    );
  }

  return (
    <div className="flex justify-center items-center gap-3 mb-4">
      {/* Icon + Label */}
      <span className="flex items-center gap-1 text-sm font-medium text-gray-700">
        {mode === "a4" ? <FileText size={16} /> : <Smartphone size={16} />}
        {mode === "a4" ? "A4 Preview" : "Card View"}
      </span>

      {/* Switch */}
      <button
        onClick={toggleMode}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 
          ${mode === "card" ? "bg-green-500" : "bg-blue-500"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300
            ${mode === "card" ? "translate-x-5" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}
