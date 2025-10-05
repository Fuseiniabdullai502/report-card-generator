"use client";

import { useState, useEffect } from "react";

export default function PreviewSwitch() {
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
    <div className="flex justify-center items-center gap-3 mb-4">
      <span className="text-sm font-medium text-gray-700">
        {mode === "a4" ? "A4 Preview" : "Card View"}
      </span>
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
