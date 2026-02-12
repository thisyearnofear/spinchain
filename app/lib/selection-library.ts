export interface AvatarAsset {
  id: string;
  name: string;
  type: "humanoid" | "creature" | "robot";
  modelUrl: string; // GLB/GLTF URL
  thumbnail: string;
  description: string;
}

export interface EquipmentAsset {
  id: string;
  name: string;
  type: "bike" | "vehicle" | "creature";
  modelUrl: string;
  thumbnail: string;
  speedMultiplier: number;
}

export interface WorldAsset {
  id: string;
  name: string;
  theme: "neon" | "alpine" | "mars" | "anime" | "rainbow";
  skyboxUrl?: string;
  fogColor: string;
  ambientColor: string;
  description: string;
}

export const AVATARS: AvatarAsset[] = [
  {
    id: "default-human",
    name: "Astra",
    type: "humanoid",
    modelUrl: "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/ready-player-me/model.glb",
    thumbnail: "/images/avatars/astra.png",
    description: "Elite spin instructor with cybernetic enhancements.",
  },
  {
    id: "space-cat",
    name: "Captain Mittens",
    type: "creature",
    modelUrl: "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/cat/model.glb",
    thumbnail: "/images/avatars/cat.png",
    description: "A feline explorer from the Meow-ky Way.",
  },
  {
    id: "bot-01",
    name: "UNIT-42",
    type: "robot",
    modelUrl: "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/robot-1/model.glb",
    thumbnail: "/images/avatars/unit42.png",
    description: "Precision-engineered for maximum efficiency.",
  },
  {
    id: "ghost-rider",
    name: "Spooky",
    type: "creature",
    modelUrl: "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/ghost/model.glb",
    thumbnail: "/images/avatars/ghost.png",
    description: "He doesn't have legs, but he's got great cadence.",
  }
];

export const EQUIPMENT: EquipmentAsset[] = [
  {
    id: "spin-bike-01",
    name: "Nebula GX",
    type: "bike",
    modelUrl: "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/bicycle/model.glb",
    thumbnail: "/images/equipment/nebula.png",
    speedMultiplier: 1.0,
  },
  {
    id: "cyber-cycle",
    name: "Light Rider",
    type: "bike",
    modelUrl: "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/key-cap/model.glb", // Using keycap as quirky placeholder
    thumbnail: "/images/equipment/cycle.png",
    speedMultiplier: 1.1,
  },
  {
    id: "hover-pod",
    name: "Void Runner",
    type: "vehicle",
    modelUrl: "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/spaceship/model.glb",
    thumbnail: "/images/equipment/void-runner.png",
    speedMultiplier: 1.2,
  },
  {
    id: "floating-cloud",
    name: "Nimbus 2000",
    type: "vehicle",
    modelUrl: "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/cloud/model.glb",
    thumbnail: "/images/equipment/cloud.png",
    speedMultiplier: 0.9,
  }
];

export const WORLDS: WorldAsset[] = [
  {
    id: "neon-city",
    name: "Neon City",
    theme: "neon",
    fogColor: "#07090f",
    ambientColor: "#6d7cff",
    description: "A futuristic cityscape with glowing grids and endless energy.",
  },
  {
    id: "anime-valley",
    name: "Toon Valley",
    theme: "anime",
    fogColor: "#ffdeeb",
    ambientColor: "#ff90b3",
    description: "Hand-painted landscapes with cel-shaded charm.",
  },
  {
    id: "rainbow-road",
    name: "Rainbow Circuit",
    theme: "rainbow",
    fogColor: "#1a0b2e",
    ambientColor: "#ff00ff",
    description: "A high-speed race through a psychedelic nebula.",
  },
  {
    id: "mars-outpost",
    name: "Red Sands",
    theme: "mars",
    fogColor: "#451a1a",
    ambientColor: "#fbbf24",
    description: "Endurance training on the surface of the red planet.",
  }
];

export interface RideTemplate {
  id: string;
  name: string;
  description: string;
  avatarId: string;
  equipmentId: string;
  worldId: string;
  badge: string;
}

export const RIDE_TEMPLATES: RideTemplate[] = [
  {
    id: "cyberpunk",
    name: "The Neon Protocol",
    description: "High-octane sprint through a futuristic metropolis.",
    avatarId: "bot-01",
    equipmentId: "cyber-cycle",
    worldId: "neon-city",
    badge: "⚡ Cyber",
  },
  {
    id: "cosmic-cat",
    name: "Space Cat Odyssey",
    description: "A whimsical journey through the rainbow nebula.",
    avatarId: "space-cat",
    equipmentId: "hover-pod",
    worldId: "rainbow-road",
    badge: "🐱 Fun",
  },
  {
    id: "ghost-climb",
    name: "Spectral Ascent",
    description: "Spooky endurance training in a toon-style valley.",
    avatarId: "ghost-rider",
    equipmentId: "floating-cloud",
    worldId: "anime-valley",
    badge: "👻 Spooky",
  }
];
