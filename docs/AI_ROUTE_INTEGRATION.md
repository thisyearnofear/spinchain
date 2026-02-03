# AI Route Generation Integration

This document describes the AI-powered route generation system integrated into SpinChain, inspired by the [map-agent project](https://github.com/jeantimex/map-agent).

## Overview

SpinChain now features natural language route creation, allowing instructors to describe routes in plain English and have them automatically generated with elevation profiles, story beats, and GPX export capabilities.

## Architecture

### Core Principles Applied

- **Enhancement First**: Enhanced existing route builder instead of creating new pages
- **Aggressive Consolidation**: Unified all AI services into a single module
- **DRY**: Single `AIService` class for all AI interactions
- **Clean Separation**: Clear boundaries between API layer, service layer, and UI components
- **Modular**: Independent, testable components with explicit dependencies

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Route Builder UI                         │
│  ┌──────────────────┐           ┌──────────────────┐       │
│  │  AI Generate Tab │           │  GPX Upload Tab  │       │
│  │ (NEW)           │           │  (Existing)      │       │
│  └──────────────────┘           └──────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                      ↓                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AIService (app/lib/ai-service.ts)                   │  │
│  │  - generateRoute()                                    │  │
│  │  - generateNarrative()                                │  │
│  │  - chat()                                             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Route Generation Utils (app/lib/route-generation.ts)│  │
│  │  - convertToGpxSummary()                             │  │
│  │  - exportToGPX()                                      │  │
│  │  - downloadGPX()                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Server-Side)                   │
│  /api/ai/generate-route     - Generate routes from prompts  │
│  /api/ai/generate-narrative - Create route descriptions     │
│  /api/ai/chat               - General AI chat               │
└─────────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                External AI Provider (Gemini)                 │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### For Instructors

1. Navigate to `/routes/builder`
2. Click the **AI Generate** tab
3. Describe your route in natural language:
   - "45-minute coastal climb with ocean views"
   - "Fast urban sprint through downtown"
   - "Mountain ascent with challenging gradients"
4. Set duration and difficulty
5. Click **Generate Route**
6. Preview the route in 3D with story beats
7. Export as GPX or save to class

### For Developers

#### Using the AI Service

```typescript
import { getAIService } from "@/app/lib/ai-service";

const aiService = getAIService();

// Generate a route
const route = await aiService.generateRoute({
  prompt: "coastal climb with ocean views",
  duration: 45,
  difficulty: "moderate",
});

// Generate narrative
const narrative = await aiService.generateNarrative(
  elevationProfile,
  "neon",
  45
);
```

#### Using the Hook

```typescript
import { useAIRoute } from "@/app/hooks/use-ai-route";

function MyComponent() {
  const { generateRoute, route, isGenerating, exportGPX } = useAIRoute();

  const handleGenerate = async () => {
    await generateRoute({
      prompt: "mountain climb",
      duration: 45,
      difficulty: "hard",
    });
  };

  return (
    <button onClick={handleGenerate} disabled={isGenerating}>
      {isGenerating ? "Generating..." : "Generate Route"}
    </button>
  );
}
```

## Features

### ✅ Implemented (MVP)

- **Natural Language Input**: Describe routes in plain English
- **Automatic Route Generation**: AI creates coordinates, elevation, and story beats
- **GPX Export**: Download generated routes as standard GPX files
- **Integration with Existing UI**: Seamlessly embedded in route builder
- **Mock Implementation**: Working demo without external API dependencies
- **Unified AI Service**: Single source of truth for all AI interactions

### 🚧 Future Enhancements (Phase 2)

- **Real Gemini API Integration**: Replace mock with actual Google Gemini API
- **Google Maps Integration**: Real-world route data and Street View preview
- **Voice Input**: Speak your route description
- **Multi-Route Series**: Generate training programs across multiple days
- **Route Optimization**: AI suggests improvements based on ride goals
- **Community Templates**: Share and discover AI-generated routes

## Configuration

### Environment Variables

```env
# Required for production (Phase 2)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional
NEXT_PUBLIC_AI_PROVIDER=gemini  # or "openai" in future
```

### Current Implementation

The MVP uses **mock implementations** that generate realistic routes without requiring external API keys. This allows immediate testing and development.

To switch to real Gemini API:

1. Uncomment the Gemini API code in `/app/api/ai/generate-route/route.ts`
2. Add `GEMINI_API_KEY` to your `.env.local`
3. Install `@google/generative-ai` package (already in dependencies)

## Testing

Run the integration test suite:

```bash
npm run dev
# In another terminal:
bash tmp_rovodev_test_integration.sh
```

Or manually test:

```bash
# Test route generation
curl -X POST http://localhost:3000/api/ai/generate-route \
  -H "Content-Type: application/json" \
  -d '{"prompt":"coastal climb","duration":45,"difficulty":"moderate","provider":"gemini"}'

# Test narrative generation  
curl -X POST http://localhost:3000/api/ai/generate-narrative \
  -H "Content-Type: application/json" \
  -d '{"elevationProfile":[100,150,200],"theme":"alpine","duration":40,"provider":"gemini"}'
```

## Design Decisions

### Why Server-Side API Routes?

- **Security**: API keys never exposed to client
- **Rate Limiting**: Centralized control over AI usage
- **Caching**: Future ability to cache common requests
- **Cost Control**: Monitor and limit AI API calls

### Why Mock Implementation First?

- **Zero Dependencies**: Works immediately without API keys
- **Fast Iteration**: Develop UI/UX without API latency
- **Predictable Testing**: Consistent outputs for integration tests
- **Future-Proof**: Easy swap to real API when ready

### Why Consolidate AI Services?

- **Single Source of Truth**: All AI config in one place
- **Consistent Error Handling**: Unified error patterns
- **Easier Testing**: Mock once, test everywhere
- **Maintainability**: Future AI provider changes isolated to one module

## Integration with Existing Features

### Route Visualizer
- AI-generated routes automatically feed into existing `RouteVisualizer` component
- Story beats detected by AI show up as waypoints in 3D visualization
- Theme selection (neon/alpine/mars) works identically for AI and GPX routes

### GPX Uploader
- Both tabs (AI Generate and GPX Upload) produce the same `GpxSummary` format
- Seamless switching between manual upload and AI generation
- Instructor can start with AI, then upload GPX to refine

### AI Instructor
- Both features share the same `AIService` foundation
- Future: AI instructors can use route generation to create dynamic classes
- Consistent personality system across features

## Performance Considerations

- **Lazy Loading**: AI components only load when "AI Generate" tab is active
- **Optimistic Updates**: UI responds immediately while API processes
- **Client-Side Caching**: `getAIService()` singleton prevents duplicate instances
- **Route Sampling**: Elevation profiles sampled to 100 points for performance

## Privacy & Security

- **API Key Protection**: All Gemini API calls server-side only
- **No User Data Sent**: Route prompts are ephemeral, not stored
- **Local Processing**: GPX conversion happens client-side
- **Future ZK Integration**: Align with SpinChain's privacy-first philosophy

## Acknowledgments

Inspired by [jeantimex/map-agent](https://github.com/jeantimex/map-agent) - an excellent example of AI-powered map interactions and natural language interfaces.

## Support

For issues or questions:
- Check existing routes in `/routes/builder`
- Review API responses in browser DevTools
- See integration test output for diagnostics
