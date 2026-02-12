"use client";

import { useState } from "react";
import { AVATARS, EQUIPMENT, WORLDS, RIDE_TEMPLATES, type AvatarAsset, type EquipmentAsset, type WorldAsset, type RideTemplate } from "@/app/lib/selection-library";
import { GlassCard, SectionHeader, Tag } from "@/app/components/ui/ui";
import { motion, AnimatePresence } from "framer-motion";

interface SelectionGarageProps {
  onSelectionChange: (selection: {
    avatar: AvatarAsset;
    equipment: EquipmentAsset;
    world: WorldAsset;
  }) => void;
  initialSelection?: {
    avatarId?: string;
    equipmentId?: string;
    worldId?: string;
  };
}

export function SelectionGarage({ onSelectionChange, initialSelection }: SelectionGarageProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarAsset>(
    AVATARS.find(a => a.id === initialSelection?.avatarId) || AVATARS[0]
  );
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentAsset>(
    EQUIPMENT.find(e => e.id === initialSelection?.equipmentId) || EQUIPMENT[0]
  );
  const [selectedWorld, setSelectedWorld] = useState<WorldAsset>(
    WORLDS.find(w => w.id === initialSelection?.worldId) || WORLDS[0]
  );

  const [activeTab, setActiveTab] = useState<"templates" | "avatar" | "equipment" | "world">("templates");

  const applyTemplate = (template: RideTemplate) => {
    const avatar = AVATARS.find(a => a.id === template.avatarId) || selectedAvatar;
    const equipment = EQUIPMENT.find(e => e.id === template.equipmentId) || selectedEquipment;
    const world = WORLDS.find(w => w.id === template.worldId) || selectedWorld;

    setSelectedAvatar(avatar);
    setSelectedEquipment(equipment);
    setSelectedWorld(world);
    onSelectionChange({ avatar, equipment, world });
    setActiveTab("avatar"); // Switch to avatar tab to show result
  };

  const updateSelection = (
    avatar: AvatarAsset = selectedAvatar,
    equipment: EquipmentAsset = selectedEquipment,
    world: WorldAsset = selectedWorld
  ) => {
    onSelectionChange({ avatar, equipment, world });
  };

  return (
    <GlassCard className="p-6">
      <SectionHeader
        eyebrow="Garage"
        title="Identity & Environment"
        description="Choose how you appear and where you race."
      />

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-white/10 pb-4 overflow-x-auto scrollbar-hide">
        {[
          { id: "templates", label: "Presets", icon: "✨" },
          { id: "avatar", label: "Avatar", icon: "👤" },
          { id: "equipment", label: "Equipment", icon: "🚴" },
          { id: "world", label: "World", icon: "🌍" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "text-white/40 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Selection Grid */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {activeTab === "templates" && (
              <motion.div
                key="templates-grid"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid gap-3"
              >
                {RIDE_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-white">{template.name}</span>
                        <Tag className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px]">
                          {template.badge}
                        </Tag>
                      </div>
                      <p className="text-xs text-white/50">{template.description}</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                      <span className="text-white">→</span>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}

            {activeTab === "avatar" && (
              <motion.div
                key="avatar-grid"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-2 gap-3"
              >
                {AVATARS.map((avatar) => (
                  <AssetCard
                    key={avatar.id}
                    asset={avatar}
                    isSelected={selectedAvatar.id === avatar.id}
                    onClick={() => {
                      setSelectedAvatar(avatar);
                      updateSelection(avatar);
                    }}
                  />
                ))}
              </motion.div>
            )}

            {activeTab === "equipment" && (
              <motion.div
                key="equipment-grid"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-2 gap-3"
              >
                {EQUIPMENT.map((item) => (
                  <AssetCard
                    key={item.id}
                    asset={item}
                    isSelected={selectedEquipment.id === item.id}
                    onClick={() => {
                      setSelectedEquipment(item);
                      updateSelection(undefined, item);
                    }}
                  />
                ))}
              </motion.div>
            )}

            {activeTab === "world" && (
              <motion.div
                key="world-grid"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-2 gap-3"
              >
                {WORLDS.map((world) => (
                  <AssetCard
                    key={world.id}
                    asset={world}
                    isSelected={selectedWorld.id === world.id}
                    onClick={() => {
                      setSelectedWorld(world);
                      updateSelection(undefined, undefined, world);
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Preview Panel */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 flex flex-col items-center justify-center text-center sticky top-0">
          <div className="mb-6 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/5 relative group">
            {/* Asset Icons as placeholders for 3D preview */}
            <div className="text-7xl transition-transform duration-500 group-hover:scale-110">
              {activeTab === "avatar" || activeTab === "templates" ? (
                <AssetIcon asset={selectedAvatar} />
              ) : activeTab === "equipment" ? (
                <AssetIcon asset={selectedEquipment} />
              ) : (
                <AssetIcon asset={selectedWorld} />
              )}
            </div>
            
            <div className="absolute inset-0 rounded-full border border-white/10 animate-[spin_10s_linear_infinite]" />
            <div className="absolute inset-2 rounded-full border border-indigo-500/20 animate-[spin_15s_linear_infinite_reverse]" />
            
            {/* Badges */}
            <div className="absolute -bottom-2 flex gap-2">
              <Tag className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                {activeTab === "avatar" || activeTab === "templates" ? selectedAvatar.type : activeTab === "equipment" ? selectedEquipment.type : selectedWorld.theme}
              </Tag>
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mb-2">
            {activeTab === "avatar" || activeTab === "templates" ? selectedAvatar.name : activeTab === "equipment" ? selectedEquipment.name : selectedWorld.name}
          </h3>
          <p className="text-sm text-white/50 max-w-xs leading-relaxed">
            {activeTab === "avatar" || activeTab === "templates" ? selectedAvatar.description : activeTab === "equipment" ? "High performance gear for competitive racing." : selectedWorld.description}
          </p>

          <div className="mt-8 w-full p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
             <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold">
                <span className="text-white/40">Current Loadout</span>
                <span className="text-indigo-400">Synced</span>
             </div>
             <div className="flex justify-around">
                <LoadoutBadge icon={<AssetIcon asset={selectedAvatar} size="xs" />} label="Rider" />
                <LoadoutBadge icon={<AssetIcon asset={selectedEquipment} size="xs" />} label="Gear" />
                <LoadoutBadge icon={<AssetIcon asset={selectedWorld} size="xs" />} label="World" />
             </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function AssetIcon({ asset, size = "md" }: { asset: any; size?: "xs" | "md" }) {
  const emoji = asset.theme === "neon" ? "🌆" : 
                asset.theme === "anime" ? "🌸" : 
                asset.theme === "rainbow" ? "🌈" : 
                asset.theme === "mars" ? "☄️" :
                asset.id === "space-cat" ? "🐱" :
                asset.id === "ghost-rider" ? "👻" :
                asset.id === "floating-cloud" ? "☁️" :
                asset.id === "cyber-cycle" ? "🏍️" :
                asset.type === "humanoid" ? "👩‍🚀" : 
                asset.type === "robot" ? "🤖" : 
                asset.type === "creature" ? "🐉" :
                asset.type === "bike" ? "🚲" : 
                asset.type === "vehicle" ? "🚀" : "🐢";
  
  return <span className={size === "xs" ? "text-sm" : ""}>{emoji}</span>;
}

function LoadoutBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
        {icon}
      </div>
      <span className="text-[8px] uppercase text-white/30 font-bold">{label}</span>
    </div>
  );
}

function AssetCard({ asset, isSelected, onClick }: { asset: any; isSelected: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border p-4 transition-all ${
        isSelected
          ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
          : "border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10"
      }`}
    >
      <div className="flex flex-col items-start gap-2">
        <div className={`text-2xl transition-transform duration-500 group-hover:rotate-12 ${isSelected ? "animate-pulse" : ""}`}>
          <AssetIcon asset={asset} />
        </div>
        <div className="text-left">
          <p className={`text-sm font-bold ${isSelected ? "text-white" : "text-white/70"}`}>
            {asset.name}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            {asset.type || asset.theme}
          </p>
        </div>
      </div>
      {isSelected && (
        <motion.div 
          layoutId="selected-indicator"
          className="absolute right-3 top-3"
        >
          <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
        </motion.div>
      )}
    </motion.button>
  );
}

