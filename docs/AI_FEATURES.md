# SpinChain AI Features Guide

Complete guide to the AI-powered route generation system.

## 🎯 Overview

SpinChain's AI route generation system transforms natural language descriptions into fully-realized spin class routes with elevation profiles, story beats, and immersive visualizations.

## ✨ Key Features

### 1. Natural Language Route Creation
Describe your ideal route in plain English, and AI generates complete route data:

**Example Prompts:**
- "A 45-minute coastal climb with ocean views starting from Santa Monica"
- "Fast urban sprint through downtown with minimal stops"
- "Beginner-friendly rolling hills for endurance training"
- "Challenging mountain ascent with valley views and steep sections"

### 2. Voice Input (Hands-Free)
Use your voice to describe routes without typing:
- Click the "Voice" button to start listening
- Speak naturally - the system captures your description
- Works in all modern browsers supporting Web Speech API
- Perfect for instructors planning while reviewing other content

### 3. Route Library
Save and organize your favorite AI-generated routes:
- **Save**: Store routes with custom tags (climbing, long-distance, challenging)
- **Favorite**: Star your best routes for quick access
- **Search**: Find routes by name, description, or tags
- **Export**: Download your entire library as JSON
- **Browse**: Beautiful grid view with stats and previews
- **Auto-tagging**: Routes automatically tagged based on characteristics

### 4. Enhanced Visualization
Every generated route includes:
- **3D Route Preview**: Real-time elevation visualization with theme support (neon/alpine/mars)
- **Story Beats**: AI-detected moments of high intensity (climbs, sprints, descents)
- **Difficulty Badges**: Visual indicators for easy/moderate/hard routes
- **Stat Cards**: Distance, duration, and elevation gain with icons
- **Progress Bars**: Visual representation of story beat timing

### 5. Smart AI Integration
Powered by Google Gemini with sophisticated prompting:
- **Contextual Understanding**: AI interprets location hints, intensity levels, and preferences
- **Realistic Terrain**: Elevation profiles match real-world cycling physics
- **Story Beat Detection**: Automatic identification of dramatic route moments
- **Adaptive Difficulty**: Route complexity adjusts based on your settings

## 🎨 Design System

### Glassmorphic UI
All AI components follow SpinChain's design language:
```css
/* Glass surfaces */
background: gradient-to-br from-white/10 to-white/5
border: border-white/10
backdrop-blur

/* Accent colors */
--accent: #6d7cff (primary gradient start)
--accent-strong: #9b7bff (primary gradient end)
```

### Animations
- **Fade-in**: Smooth element appearances
- **Slide-in**: Contextual entry animations
- **Shimmer**: Hover effects on buttons
- **Pulse**: Loading states and active indicators
- **Spring**: Micro-interactions with spring easing

### Typography
- **Uppercase tracking**: Small labels with 0.2em letter-spacing
- **Font weights**: 
  - Regular (400) for body text
  - Medium (500) for labels
  - Semibold (600) for subheadings
  - Bold (700) for headings

## 🔧 Technical Architecture

### Client-Side Components
```
AIRouteGenerator
├── Voice Input (useVoiceInput hook)
├── Route Generation (useAIRoute hook)
├── Library Management (useRouteLibrary hook)
└── Route Visualization (RouteVisualizer component)
```

### API Layer (Server-Side)
```
/api/ai/
├── generate-route    - Create routes from prompts
├── generate-narrative - Generate themed descriptions
└── chat              - General AI assistance
```

### Data Flow
```
User Prompt → AI Service → Gemini API → Route Data → GPX Conversion → 3D Visualization
                                      ↓
                                 Route Library
```

## 📊 Usage Patterns

### For Instructors

**Quick Route Creation:**
1. Open `/routes/builder`
2. Click "AI Generate" tab
3. Describe your vision
4. Set duration and difficulty
5. Generate and preview
6. Save to library or export as GPX

**Building a Class Series:**
1. Generate multiple routes with varied themes
2. Save each to library with tags
3. Browse library to select routes for upcoming classes
4. Export as GPX for upload to other platforms

### For Developers

**Integrating AI Service:**
```typescript
import { getAIService } from '@/app/lib/ai-service';

const aiService = getAIService();
const route = await aiService.generateRoute({
  prompt: "mountain climb",
  duration: 45,
  difficulty: "hard"
});
```

**Using Route Library:**
```typescript
import { useRouteLibrary } from '@/app/hooks/use-route-library';

function MyComponent() {
  const { routes, saveRoute, toggleFavorite } = useRouteLibrary();
  
  // Save a generated route
  saveRoute(generatedRoute, {
    author: "Coach Atlas",
    tags: ["climbing", "advanced"]
  });
}
```

## 🚀 Performance

### Optimizations
- **Lazy Loading**: AI components only load when needed
- **Client-Side Caching**: Route library stored in localStorage
- **Optimistic Updates**: UI responds immediately
- **Mock Fallback**: Graceful degradation without API key
- **Progressive Enhancement**: Works without JavaScript (basic GPX upload)

### Loading Times
- Route generation: 1-3 seconds (with Gemini API)
- Mock generation: <500ms
- Library load: <100ms (from localStorage)
- Voice recognition: Instant activation

## 🔐 Privacy & Security

### Data Handling
- **No Server Storage**: Routes never stored on backend
- **Local Library**: All saved routes in browser localStorage
- **Ephemeral Prompts**: User inputs not logged or retained
- **API Key Protection**: Gemini key server-side only

### Voice Input
- **Browser Native**: Uses Web Speech API (local processing)
- **No Recording**: Speech converted to text immediately
- **User Control**: Explicit start/stop controls

## 🎓 Best Practices

### Writing Effective Prompts
**Good:**
- "45-minute coastal climb with ocean views and sunset atmosphere"
- "High-intensity interval training with 5 sprint sections"
- "Beginner-friendly route with gentle rolling hills"

**Avoid:**
- Too vague: "make a route"
- Conflicting: "easy but very challenging climb"
- Unrealistic: "1000km in 10 minutes"

### Route Library Management
- **Tag Consistently**: Use standard tags (climbing, sprints, endurance)
- **Favorite Strategically**: Star your go-to routes
- **Regular Cleanup**: Remove unused routes to stay under 50-route limit
- **Export Backups**: Download library JSON periodically

### Performance Tips
- Clear browser cache if library becomes sluggish
- Limit route library to ~30 routes for optimal performance
- Use search instead of scrolling through many routes
- Export and reimport to clean up corrupted data

## 🐛 Troubleshooting

### Voice Input Not Working
- **Check browser support**: Chrome, Edge, Safari support Web Speech API
- **Grant permissions**: Allow microphone access when prompted
- **Check connection**: Voice recognition requires internet
- **Try again**: Sometimes recognition needs a second attempt

### AI Generation Errors
- **Check API key**: Ensure `GEMINI_API_KEY` is set (falls back to mock)
- **Network issues**: Verify internet connection
- **Rate limits**: Wait 30 seconds if you hit API limits
- **Mock mode**: App works without API key using realistic mock data

### Library Issues
- **Storage full**: Browser localStorage has 5-10MB limit
- **Corrupted data**: Export library, clear storage, reimport
- **Missing routes**: Check if filtered by favorites or search

## 📈 Future Enhancements

### Phase 2 (Q2 2026)
- [ ] Google Maps integration for real-world route data
- [ ] Street View preview for route immersion
- [ ] Multi-day training program generation
- [ ] Community route sharing
- [ ] Advanced AI personalities (different coaching styles)

### Phase 3 (Q3 2026)
- [ ] Voice-guided ride experience
- [ ] Real-time route adjustments based on group performance
- [ ] Integration with fitness tracking devices
- [ ] AI-powered music playlist matching

## 🔗 Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Roadmap](./ROADMAP.md)
- [Integration Guide](./AI_ROUTE_INTEGRATION.md)
- [HackMoney Submission](./HACKMONEY.md)

## 💬 Support

For issues or questions:
1. Check browser console for errors
2. Test with mock data (no API key)
3. Review integration tests: `bash tmp_rovodev_integration_test.sh`
4. Open issue on GitHub with error details
