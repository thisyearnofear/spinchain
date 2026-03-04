# SpinChain: User Onboarding & First Ride Guide

## Overview

SpinChain is designed for frictionless onboarding, allowing users to experience the "Spin & Earn" loop before committing to a wallet or connecting hardware.

---

## 🏁 The Onboarding Flow

### 1. Welcome Modal
New users are greeted with a 3-step introductory modal:
- **What is SpinChain?**: The concept of earning tokens through effort.
- **Earn As You Ride**: How heart rate and power translate to SPIN rewards.
- **Privacy Built-In**: Explanation of ZK proofs and data ownership.

### 2. Guest Mode
- Users can skip wallet connection and "Explore as Guest".
- A prominent **"Try Demo Ride"** banner allows immediate access to the ride experience.
- Guest rides show **estimated rewards** and stats, encouraging users to connect a wallet to claim real value.

### 3. Onboarding Checklist
A persistent checklist on the rider dashboard guides users through:
- [ ] Connect Wallet
- [ ] Link BLE Device (or try simulator)
- [ ] Complete First Ride

---

## 🚴 The Ride Experience

### Pre-Ride Setup
Before starting a ride, users can choose their **Input Mode**:
- **BLE Device**: Connects to smart bikes or heart rate monitors using the native Capacitor BLE stack.
- **Pedal Simulator**: An immersive digital control for users without hardware.

### HUD Tutorial
A 4-step interactive overlay appears on the first ride:
1. **Metrics Panel**: Heart rate, power, cadence, and speed.
2. **Effort Score**: The core metric driving ZK-based rewards.
3. **ZK Privacy Shield**: Visual indicator of local proof generation.
4. **Start Controls**: Final guidance to begin the session.

---

## ⌨️ Pedal Simulator UX

For users without hardware, the Pedal Simulator provides an engaging experience:
- **Animated Crank**: Visual feedback of pedaling speed (RPM).
- **Cadence Zones**: Color-coded rings (Rest → Easy → Steady → Push → Sprint).
- **Haptic Feedback**: Subtle vibrations on every pedal tap (mobile only).
- **Keyboard Support**: Use arrow keys (← / →) to pedal on desktop.
- **No HUD Overlap**: Smart layout ensures controls don't block the 3D visualizer or HUD.

---

## 📊 Post-Ride & Rewards

### Ride Completion
- **Stats Summary**: Avg Heart Rate, Power, and Effort Score.
- **Telemetry Badge**: Identifies the source (Live Bike vs. Simulator).

### Claiming Rewards
1. **ZK Proof Generation**: Takes 10-30 seconds in-browser.
2. **Privacy Badge**: Displays the privacy level achieved.
3. **On-Chain Settlement**: Submits the proof to the Avalanche Fuji verifier.
4. **Token Distribution**: SPIN tokens are minted to the rider's wallet.

---

## 🛠️ Testing Script for Users

To get a new user started, send them this message:

> "Open [https://spinchain.vercel.app](https://spinchain.vercel.app) on your phone or laptop. Tap through the intro, then hit **Try Demo Ride**. Pick a workout plan, select **Simulator** (if you're not on a bike), and tap **Start Ride**. Pedal away! When you're done, let me know if anything felt confusing."
