"use client";

import { useCallback, useState } from "react";

export type InstructorClassMode = "standard" | "agentic";
export type InstructorClassPersonality = "zen" | "drill-sergeant" | "data";
export type InstructorClassDraftStatus = "draft" | "ready_to_publish";

export interface InstructorClassDraftFormData {
  name: string;
  description: string;
  duration: number;
  maxRiders: number;
  basePrice: string;
  mode: InstructorClassMode;
  personality: InstructorClassPersonality;
  enableDynamicPricing: boolean;
  useAI: boolean;
}

interface StoredInstructorClassDraft {
  version: 1;
  savedAt: number | null;
  status: InstructorClassDraftStatus;
  formData: InstructorClassDraftFormData;
}

const STORAGE_KEY = "spinchain:instructor:class-draft:v1";

function createDefaultDraft(
  initialFormData: InstructorClassDraftFormData,
): StoredInstructorClassDraft {
  return {
    version: 1,
    savedAt: null,
    status: "draft",
    formData: initialFormData,
  };
}

function hasWindow() {
  return typeof window !== "undefined";
}

function readStoredDraft(
  initialFormData: InstructorClassDraftFormData,
): { draft: StoredInstructorClassDraft; restored: boolean } {
  if (!hasWindow()) {
    return { draft: createDefaultDraft(initialFormData), restored: false };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { draft: createDefaultDraft(initialFormData), restored: false };
    }

    const parsed = JSON.parse(raw) as Partial<StoredInstructorClassDraft>;
    const formData = parsed.formData;

    if (!formData || typeof formData !== "object") {
      return { draft: createDefaultDraft(initialFormData), restored: false };
    }

    return {
      restored: true,
      draft: {
        version: 1,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : null,
        status: parsed.status === "ready_to_publish" ? "ready_to_publish" : "draft",
        formData: {
          name: typeof formData.name === "string" ? formData.name : initialFormData.name,
          description:
            typeof formData.description === "string"
              ? formData.description
              : initialFormData.description,
          duration:
            typeof formData.duration === "number" ? formData.duration : initialFormData.duration,
          maxRiders:
            typeof formData.maxRiders === "number"
              ? formData.maxRiders
              : initialFormData.maxRiders,
          basePrice:
            typeof formData.basePrice === "string"
              ? formData.basePrice
              : initialFormData.basePrice,
          mode: formData.mode === "agentic" ? "agentic" : initialFormData.mode,
          personality:
            formData.personality === "zen" ||
            formData.personality === "drill-sergeant" ||
            formData.personality === "data"
              ? formData.personality
              : initialFormData.personality,
          enableDynamicPricing:
            typeof formData.enableDynamicPricing === "boolean"
              ? formData.enableDynamicPricing
              : initialFormData.enableDynamicPricing,
          useAI: typeof formData.useAI === "boolean" ? formData.useAI : initialFormData.useAI,
        },
      },
    };
  } catch {
    return { draft: createDefaultDraft(initialFormData), restored: false };
  }
}

export function getStoredInstructorClassDraft(
  initialFormData: InstructorClassDraftFormData,
) {
  return readStoredDraft(initialFormData);
}

function writeStoredDraft(draft: StoredInstructorClassDraft) {
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

function clearStoredDraft() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function clearStoredInstructorClassDraft() {
  clearStoredDraft();
}

export function isInstructorClassDraftComplete(
  formData: InstructorClassDraftFormData,
) {
  return (
    formData.name.trim().length > 0 &&
    formData.description.trim().length > 0 &&
    Number.parseFloat(formData.basePrice) > 0 &&
    formData.duration > 0 &&
    formData.maxRiders > 0
  );
}

export function useInstructorClassDraft(
  initialFormData: InstructorClassDraftFormData,
) {
  const [{ draft, restored }] = useState(() => readStoredDraft(initialFormData));
  const [draftState, setDraftState] = useState<StoredInstructorClassDraft>(draft);

  const updateForm = useCallback(
    (updates: Partial<InstructorClassDraftFormData>) => {
      setDraftState((current) => ({
        ...current,
        status: current.status === "ready_to_publish" ? "draft" : current.status,
        formData: {
          ...current.formData,
          ...updates,
        },
      }));
    },
    [],
  );

  const saveDraft = useCallback((status: InstructorClassDraftStatus = "draft") => {
    const savedAt = Date.now();

    setDraftState((current) => {
      const next = {
        ...current,
        status,
        savedAt,
      };

      writeStoredDraft(next);
      return next;
    });

    return savedAt;
  }, []);

  const resetDraft = useCallback(() => {
    clearStoredDraft();
    setDraftState(createDefaultDraft(initialFormData));
  }, [initialFormData]);

  return {
    formData: draftState.formData,
    draftStatus: draftState.status,
    lastSavedAt: draftState.savedAt,
    wasRestored: restored,
    isComplete: isInstructorClassDraftComplete(draftState.formData),
    updateForm,
    saveDraft,
    resetDraft,
  };
}
