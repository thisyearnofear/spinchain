"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { AnimatedCard, EnergyPulse } from "../../../components/ui/animated-card";

interface Route {
  id: string;
  name: string;
  description: string;
  image: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Extreme";
  duration: string;
  distance: string;
  elevation: string;
  theme: "forest" | "city" | "coastal" | "mountain" | "group";
  instructor: string;
  liveRiders: number;
  nextClass: string;
}

const routes: Route[] = [
  {
    id: "1",
    name: "Alpine Dawn",
    description: "Climb through misty mountain passes as the sun breaks through. A test of endurance with breathtaking views.",
    image: "/images/routes/route-mountain.jpg",
    difficulty: "Hard",
    duration: "45 min",
    distance: "18 km",
    elevation: "+420m",
    theme: "mountain",
    instructor: "Sarah Chen",
    liveRiders: 24,
    nextClass: "In 2 hours",
  },
  {
    id: "2",
    name: "Neon Grid Sprint",
    description: "High-intensity intervals through a cyberpunk cityscape. Sync your effort to the beat.",
    image: "/images/routes/route-city.jpg",
    difficulty: "Medium",
    duration: "30 min",
    distance: "12 km",
    elevation: "+80m",
    theme: "city",
      instructor: "Coachy",
    liveRiders: 156,
    nextClass: "Live now",
  },
  {
    id: "3",
    name: "Coastal Cruise",
    description: "Gentle rolling hills along the ocean. Perfect for recovery or beginners.",
    image: "/images/routes/route-coastal.jpg",
    difficulty: "Easy",
    duration: "60 min",
    distance: "25 km",
    elevation: "+150m",
    theme: "coastal",
    instructor: "Marcus Webb",
    liveRiders: 8,
    nextClass: "Tomorrow 8am",
  },
  {
    id: "4",
    name: "Redwood Challenge",
    description: "Deep forest trails with technical climbs. Lose yourself in nature while finding your limits.",
    image: "/images/routes/route-forest.jpg",
    difficulty: "Extreme",
    duration: "90 min",
    distance: "35 km",
    elevation: "+800m",
    theme: "forest",
      instructor: "Coachy Pro",
    liveRiders: 42,
    nextClass: "In 4 hours",
  },
  {
    id: "5",
    name: "Peloton Power",
    description: "Group ride simulation with drafting mechanics. Ride together, even when apart.",
    image: "/images/routes/route-group.jpg",
    difficulty: "Medium",
    duration: "45 min",
    distance: "20 km",
    elevation: "+200m",
    theme: "group",
    instructor: "Team SpinChain",
    liveRiders: 89,
    nextClass: "Every hour",
  },
];

const difficultyColors = {
  Easy: "bg-green-500/20 text-green-400 border-green-500/30",
  Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Hard: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Extreme: "bg-red-500/20 text-red-400 border-red-500/30",
};

function RouteCard({ route, index }: { route: Route; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"]
  });

  // Parallax effect for the image
  const imageY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.9, 1, 1, 0.9]);

  const isEven = index % 2 === 0;

  return (
    <motion.div
      ref={cardRef}
      style={{ opacity, scale }}
      className={`grid lg:grid-cols-2 gap-8 items-center ${isEven ? "" : "lg:grid-flow-dense"}`}
    >
      {/* Image Side */}
      <div className={`relative aspect-[16/10] rounded-3xl overflow-hidden ${isEven ? "" : "lg:col-start-2"}`}>
        <AnimatedCard className="h-full" glowColor="var(--accent)">
          <div className="relative h-full overflow-hidden">
            {/* Parallax Image */}
            <motion.div 
              className="absolute inset-0"
              style={{ y: imageY }}
            >
              <img
                src={route.image}
                alt={route.name}
                className="w-full h-[120%] object-cover"
              />
            </motion.div>
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Live Badge */}
            {route.liveRiders > 10 && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur border border-white/10">
                <EnergyPulse size="sm" />
                <span className="text-xs font-medium text-white">{route.liveRiders} riding now</span>
              </div>
            )}

            {/* Theme Tag */}
            <div className="absolute bottom-4 left-4">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur text-xs text-white/80 border border-white/10 capitalize">
                {route.theme}
              </span>
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Content Side */}
      <div className={`space-y-6 ${isEven ? "" : "lg:col-start-1 lg:row-start-1"}`}>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${difficultyColors[route.difficulty]}`}>
            {route.difficulty}
          </span>
          <span className="text-sm text-[color:var(--muted)]">{route.nextClass}</span>
        </div>

        <div>
          <h3 className="text-3xl lg:text-4xl font-bold text-[color:var(--foreground)] mb-3">
            {route.name}
          </h3>
          <p className="text-lg text-[color:var(--muted)] leading-relaxed">
            {route.description}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[color:var(--surface-strong)] border border-[color:var(--border)]">
            <p className="text-2xl font-bold text-[color:var(--foreground)]">{route.duration}</p>
            <p className="text-xs text-[color:var(--muted)] uppercase tracking-wider">Duration</p>
          </div>
          <div className="p-4 rounded-2xl bg-[color:var(--surface-strong)] border border-[color:var(--border)]">
            <p className="text-2xl font-bold text-[color:var(--foreground)]">{route.distance}</p>
            <p className="text-xs text-[color:var(--muted)] uppercase tracking-wider">Distance</p>
          </div>
          <div className="p-4 rounded-2xl bg-[color:var(--surface-strong)] border border-[color:var(--border)]">
            <p className="text-2xl font-bold text-[color:var(--foreground)]">{route.elevation}</p>
            <p className="text-xs text-[color:var(--muted)] uppercase tracking-wider">Elevation</p>
          </div>
        </div>

        {/* Instructor */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[color:var(--surface)] border border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-strong)]" />
            <div>
              <p className="text-sm font-medium text-[color:var(--foreground)]">{route.instructor}</p>
              <p className="text-xs text-[color:var(--muted)]">
                {route.instructor.startsWith("Coachy") ? "AI Training Partner" : route.instructor === "Team SpinChain" ? "Group Class" : "Human Instructor"}
              </p>
            </div>
          </div>
          <motion.a
            href={`/rider/ride/${route.id}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-2.5 rounded-full bg-[color:var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Join Class
          </motion.a>
        </div>
      </div>
    </motion.div>
  );
}

export function RouteShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Progress bar animation
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section ref={containerRef} className="relative">
      {/* Fixed Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[color:var(--surface-strong)] z-50">
        <motion.div 
          className="h-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)]"
          style={{ width: progressWidth }}
        />
      </div>

      {/* Header */}
      <div className="text-center mb-20">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-block px-4 py-1.5 rounded-full bg-[color:var(--accent)]/10 text-[color:var(--accent)] text-sm font-medium mb-4"
        >
          Featured Routes
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl lg:text-5xl font-bold text-[color:var(--foreground)] mb-4"
        >
          Worlds to Explore
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-[color:var(--muted)] max-w-2xl mx-auto"
        >
          From scenic mountain climbs to high-energy city rides—find a class 
          that matches your mood and fitness level.
        </motion.p>
      </div>

      {/* Routes */}
      <div className="space-y-32">
        {routes.map((route, index) => (
          <RouteCard key={route.id} route={route} index={index} />
        ))}
      </div>

      {/* View All CTA */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mt-32"
      >
        <a
          href="/routes"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-[color:var(--accent)] text-[color:var(--accent)] font-semibold hover:bg-[color:var(--accent)] hover:text-white transition-all"
        >
          Explore All Routes
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
      </motion.div>
    </section>
  );
}
