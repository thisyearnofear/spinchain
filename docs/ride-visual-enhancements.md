# Ride Visual Enhancements

## Overview
Enhanced existing ride visualizer components with power-reactive materials and improved visual feedback, inspired by WebGPU shader techniques.

## Changes Made

### 1. Road Component
**Enhanced**: Power-reactive emissive intensity
- Road glow now responds to both power output and cadence
- Combines cadence pulse with power boost for dynamic feedback
- More visible intensity changes during sprints

### 2. FloatingParticles Component  
**Enhanced**: Power-reactive particle behavior
- Particle size scales with power (4-6 range based on 0-300W)
- Particle speed increases with power output
- More dramatic visual feedback during high-intensity efforts

### 3. RiderMarker Component
**Enhanced**: Power-reactive trail and aura
- Trail opacity increases with power (0.3-0.7 range)
- Aura opacity more responsive to power changes
- Better visual distinction between effort levels

## Implementation Approach

Following core principles:
- ✅ **ENHANCEMENT FIRST**: Modified existing components, no new files
- ✅ **CONSOLIDATION**: Removed all bloat, kept only essential changes
- ✅ **DRY**: Single source of truth maintained
- ✅ **CLEAN**: Changes inline where they belong
- ✅ **PERFORMANT**: No additional overhead, just better calculations

## Technical Details

All enhancements use existing Three.js materials with improved dynamic properties:
- `emissiveIntensity` modulation based on telemetry
- Opacity calculations tied to power output
- Size/speed parameters reactive to rider stats

No custom shaders, no new dependencies, no bloat.

## Result

Riders now get immediate, intuitive visual feedback that scales with their effort level across the entire scene.
