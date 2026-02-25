/**
 * AI Provider Settings Component
 * 
 * Multi-provider AI architecture:
 * - Venice AI: Privacy-first inference
 * - Gemini 3: Enhanced reasoning with BYOK (Bring Your Own Key)
 */

"use client";

import { useState, useEffect } from "react";
import {
  AIProvider,
  UserAIPreferences,
  DEFAULT_AI_PREFERENCES,
  getUserAIPreferences,
  setUserAIPreferences,
  getProviderBadge,
  PROVIDERS,
} from "@/app/lib/ai-providers";
import { getAIService } from "@/app/lib/ai-service";

interface AIProviderSettingsProps {
  onProviderChange?: (provider: AIProvider) => void;
}

export function AIProviderSettings({ onProviderChange }: AIProviderSettingsProps) {
  const [prefs, setPrefs] = useState<UserAIPreferences>(() => getUserAIPreferences());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  const handleProviderChange = (provider: AIProvider) => {
    const newPrefs = { ...prefs, preferredProvider: provider };
    setPrefs(newPrefs);
    setUserAIPreferences(newPrefs);
    
    // Update the service
    const service = getAIService();
    service.switchProvider(provider);
    
    onProviderChange?.(provider);
  };

  const handleGeminiKeyChange = (key: string) => {
    const newPrefs = { ...prefs, geminiApiKey: key };
    setPrefs(newPrefs);
    setUserAIPreferences(newPrefs);
  };

  const handleToggleAdvanced = (enabled: boolean) => {
    const newPrefs = { ...prefs, enableAdvancedFeatures: enabled };
    setPrefs(newPrefs);
    setUserAIPreferences(newPrefs);
  };

  const testGeminiKey = async () => {
    if (!prefs.geminiApiKey) return;
    
    setTestStatus("testing");
    try {
      // Quick test with minimal prompt
      const response = await fetch("/api/ai/generate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "test",
          duration: 30,
          provider: "gemini",
          apiKey: prefs.geminiApiKey,
        }),
      });
      
      if (response.ok) {
        setTestStatus("success");
        setTimeout(() => setTestStatus("idle"), 3000);
      } else {
        setTestStatus("error");
      }
    } catch {
      setTestStatus("error");
    }
  };

  const currentBadge = getProviderBadge(prefs.preferredProvider);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentBadge.color} text-white hover:opacity-90`}
        title={`AI Provider: ${currentBadge.label}`}
        aria-label={`AI Provider: ${currentBadge.label}. Click to change settings.`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>{currentBadge.icon}</span>
        <span className="hidden sm:inline">{currentBadge.label}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              AI Provider Settings
            </h3>

            {/* Provider Selection */}
            <div className="space-y-3 mb-6">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Provider
              </label>
              
              {/* Venice AI Option */}
              <button
                onClick={() => handleProviderChange("venice")}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${
                  prefs.preferredProvider === "venice"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-purple-300"
                }`}
              >
                <span className="text-2xl">🔒</span>
                <div className="text-left flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    Venice AI
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Privacy-first inference. No API key required.
                  </div>
                </div>
                {prefs.preferredProvider === "venice" && (
                  <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Gemini 3 Option */}
              <button
                onClick={() => handleProviderChange("gemini")}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${
                  prefs.preferredProvider === "gemini"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                }`}
              >
                <span className="text-2xl">✨</span>
                <div className="text-left flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    Gemini 3.0 Flash
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      BYOK
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Enhanced reasoning, streaming & structured outputs. Bring your own API key.
                  </div>
                </div>
                {prefs.preferredProvider === "gemini" && (
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>

            {/* Gemini 3 Settings (only when selected) */}
            {prefs.preferredProvider === "gemini" && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gemini API Key (BYOK)
                </label>
                <div className="flex gap-2">
                  <input
                    type={showGeminiKey ? "text" : "password"}
                    value={prefs.geminiApiKey || ""}
                    onChange={(e) => handleGeminiKeyChange(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    title={showGeminiKey ? "Hide" : "Show"}
                  >
                    {showGeminiKey ? "🙈" : "👁️"}
                  </button>
                </div>
                
                {/* Test Key Button */}
                <button
                  onClick={testGeminiKey}
                  disabled={!prefs.geminiApiKey || testStatus === "testing"}
                  className={`mt-2 w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    testStatus === "success"
                      ? "bg-green-500 text-white"
                      : testStatus === "error"
                      ? "bg-red-500 text-white"
                      : "bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  }`}
                >
                  {testStatus === "testing" && "Testing..."}
                  {testStatus === "success" && "✓ Key valid!"}
                  {testStatus === "error" && "✗ Invalid key"}
                  {testStatus === "idle" && "Test API Key"}
                </button>

                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Your API key is stored locally in your browser and never sent to our servers except for AI requests.
                </p>
              </div>
            )}

            {/* Advanced Features Toggle (Gemini only) */}
            <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Advanced Features
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Streaming, multimodal, structured output
                </div>
              </div>
              <button
                onClick={() => handleToggleAdvanced(!prefs.enableAdvancedFeatures)}
                disabled={prefs.preferredProvider !== "gemini"}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  prefs.enableAdvancedFeatures && prefs.preferredProvider === "gemini"
                    ? "bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                } ${prefs.preferredProvider !== "gemini" ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    prefs.enableAdvancedFeatures && prefs.preferredProvider === "gemini"
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Info Footer */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              <p>
                <strong>💡 Tip:</strong> Both providers work great. Venice is simpler (no setup), Gemini 3 has more advanced features.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Compact version for nav bar
export function AIProviderBadge() {
  const [provider, setProvider] = useState<AIProvider>(() => getUserAIPreferences().preferredProvider);

  const badge = getProviderBadge(provider);

  return (
    <div 
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${badge.color} text-white`}
      title={badge.description}
    >
      <span>{badge.icon}</span>
      <span className="hidden sm:inline">{badge.label}</span>
    </div>
  );
}
