"use client";

import { useEffect, useRef } from "react";
import Matter from "matter-js";

export function ChainTension() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 180;

    canvas.width = width;
    canvas.height = height;

    const engine = Matter.Engine.create();
    const world = engine.world;
    engine.gravity.y = 1.2;

    const render = Matter.Render.create({
      canvas,
      engine,
      options: {
        width,
        height,
        wireframes: false,
        background: "transparent",
        showAngleIndicator: false,
      },
    });

    // Word body — maps "CHAIN" SVG bbox to a rectangle
    const wordWidth = 140;
    const wordHeight = 32;
    const wordBody = Matter.Bodies.rectangle(width / 2, 110, wordWidth, wordHeight, {
      chamfer: { radius: 6 },
      render: {
        fillStyle: "transparent",
      },
      density: 0.002,
      frictionAir: 0.02,
    });

    // Two rope anchors at top
    const anchorLeft = { x: width / 2 - 50, y: 12 };
    const anchorRight = { x: width / 2 + 50, y: 12 };

    const createRope = (anchor: { x: number; y: number }, offsetX: number) => {
      const segments = 6;
      const segmentHeight = 14;
      let prev: Matter.Body | null = null;
      const composite = Matter.Composite.create();

      for (let i = 0; i < segments; i++) {
        const y = anchor.y + 16 + i * segmentHeight;
        const segment = Matter.Bodies.rectangle(anchor.x + offsetX, y, 4, segmentHeight, {
          render: { fillStyle: "#a78bfa" },
          collisionFilter: { group: -1 },
          density: 0.001,
        });
        Matter.Composite.add(composite, segment);
        if (prev) {
          Matter.Composite.add(
            composite,
            Matter.Constraint.create({
              bodyA: prev,
              bodyB: segment,
              pointA: { x: 0, y: segmentHeight / 2 },
              pointB: { x: 0, y: -segmentHeight / 2 },
              stiffness: 0.9,
              length: 0,
              render: { strokeStyle: "#a78bfa", lineWidth: 1.5 } as unknown as Matter.IConstraintRenderDefinition,
            }),
          );
        } else {
          // Anchor to fixed point
          Matter.Composite.add(
            composite,
            Matter.Constraint.create({
              pointA: anchor,
              bodyB: segment,
              pointB: { x: 0, y: -segmentHeight / 2 },
              stiffness: 0.9,
              length: 0,
              render: { strokeStyle: "#a78bfa", lineWidth: 1.5 } as unknown as Matter.IConstraintRenderDefinition,
            }),
          );
        }
        prev = segment;
      }
      // Connect last segment to word
      if (prev) {
        Matter.Composite.add(
          composite,
          Matter.Constraint.create({
            bodyA: prev,
            bodyB: wordBody,
            pointA: { x: 0, y: segmentHeight / 2 },
            pointB: { x: offsetX, y: -wordHeight / 2 },
            stiffness: 0.7,
            length: 4,
            render: { strokeStyle: "#a78bfa", lineWidth: 1.5 } as unknown as Matter.IConstraintRenderDefinition,
          }),
        );
      }
      return composite;
    };

    const leftRope = createRope(anchorLeft, -50);
    const rightRope = createRope(anchorRight, 50);

    Matter.Composite.add(world, [wordBody, leftRope, rightRope]);

    // Mouse interaction
    const mouse = Matter.Mouse.create(canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    // Keep canvas mouse in sync with renderer
    (render as unknown as { mouse: unknown }).mouse = mouse;
    Matter.Composite.add(world, mouseConstraint);

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    // Draw word "CHAIN" as SVG overlay synced to body position
    let raf = 0;
    const wordEl = document.createElement("div");
    wordEl.textContent = "C H A I N";
    wordEl.style.position = "absolute";
    wordEl.style.left = "0";
    wordEl.style.top = "0";
    wordEl.style.fontSize = "13px";
    wordEl.style.fontWeight = "900";
    wordEl.style.letterSpacing = "0.32em";
    wordEl.style.color = "white";
    wordEl.style.pointerEvents = "none";
    wordEl.style.transform = "translate(-50%, -50%)";
    container.appendChild(wordEl);

    const syncWord = () => {
      const pos = wordBody.position;
      wordEl.style.left = `${pos.x}px`;
      wordEl.style.top = `${pos.y}px`;
      wordEl.style.transform = `translate(-50%, -50%) rotate(${wordBody.angle}rad)`;
      raf = requestAnimationFrame(syncWord);
    };
    syncWord();

    const onResize = () => {
      const w = container.clientWidth;
      Matter.Render.setPixelRatio(render, window.devicePixelRatio);
      render.canvas.width = w;
      render.options.width = w;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      wordEl.remove();
      window.removeEventListener("resize", onResize);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Composite.clear(world, false);
      Matter.Engine.clear(engine);
      render.canvas.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent"
      style={{ height: 180 }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 pointer-events-none">
        Drag the chain — tension is the training
      </p>
    </div>
  );
}
