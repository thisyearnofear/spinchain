# Ride Visual Enhancements

## Overview
Enhanced existing ride visualizer components with power-reactive materials and improved visual feedback, inspired by WebGPU shader techniques from the webgpu-claude-skill repository.

## Changes Made

### Phase 1: Power-Reactive Basics

#### 1. Road Component
**Enhanced**: Power-reactive emissive intensity
- Road glow responds to both power output and cadence
- Combines cadence pulse with power boost for dynamic feedback
- Dynamic color mixing at high power (>50% FTP)
- Smooth color transitions between base and sprint colors

#### 2. FloatingParticles Component  
**Enhanced**: Power-reactive particle behavior
- Particle size scales with power (4-6 range based on 0-300W)
- Particle speed increases with power output
- More dramatic visual feedback during high-intensity efforts

#### 3. RiderMarker Component
**Enhanced**: Power-reactive trail and aura
- Trail opacity increases with power (0.3-0.7 range)
- Aura opacity more responsive to power changes
- Better visual distinction between effort levels

### Phase 2: Advanced Visual Effects

#### 4. Fresnel-Inspired Aura Enhancement
**Enhanced**: Rider aura with fresnel-like edge glow
- Aura opacity combines base power level with fresnel boost
- More visible from all viewing angles
- Scales dynamically with both cadence and power
- Light intensity now responds to both HR and power

#### 5. Dynamic Color Mixing
**Enhanced**: Road surface color transitions
- Smooth color interpolation at high power (>50% FTP)
- Mixes base road color with line color for intensity feedback
- Maintains rainbow theme's continuous color shift
- More intuitive visual feedback during sprints

#### 6. Adaptive Quality System
**Enhanced**: Frame time monitoring and auto-adjustment
- Monitors average frame time over 60-frame windows
- Automatically reduces particle counts if FPS drops
- Gradually increases quality when performance improves
- Quality factor ranges from 0.5x to 1.0x
- Applies to sparkles, speed lines, and floating particles

## Implementation Approach

Following core principles:
- ✅ **ENHANCEMENT FIRST**: Modified existing components, no new files
- ✅ **CONSOLIDATION**: All improvements inline where they belong
- ✅ **DRY**: Single source of truth maintained
- ✅ **CLEAN**: Changes inline where they belong
- ✅ **PERFORMANT**: Auto-adjusts quality, better calculations
- ✅ **MODULAR**: No new dependencies or abstractions

## Technical Details

All enhancements use existing Three.js materials with improved dynamic properties:
- `emissiveIntensity` modulation based on telemetry
- `Color.lerpColors()` for smooth color transitions
- Opacity calculations tied to power output with fresnel-like boost
- Size/speed parameters reactive to rider stats
- Frame time monitoring for adaptive quality

No custom shaders, no new dependencies, no bloat.

## Performance Impact

- Adaptive quality system prevents FPS drops during long rides
- Quality automatically scales from 50% to 100% based on frame time
- Particle counts adjust dynamically (sparkles, speed lines, stars)
- Smooth degradation on lower-end devices
- Automatic recovery when performance improves

## Result

Riders now get immediate, intuitive visual feedback that scales with their effort level across the entire scene, with automatic quality adjustment to maintain smooth performance.
