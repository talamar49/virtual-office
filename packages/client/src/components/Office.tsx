import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Application,
  Assets,
  Container,
  Sprite,
  Spritesheet,
  AnimatedSprite,
  Texture,
  SCALE_MODES,
  Text,
  TextStyle,
  Graphics,
} from 'pixi.js';
import { AgentStatus } from '../hooks/useAgentStatuses';
import {
  TILE_MAP,
  TILE_NAMES,
  TILE_SIZE,
  MAP_COLS,
  MAP_ROWS,
  AGENT_DESKS,
  FURNITURE,
} from '../data/officeLayout';

interface OfficeProps {
  agents: AgentStatus[];
}

// Characters with sprite assets
const SPRITE_CHARACTERS = ['yogi', 'omer', 'noa'] as const;
type SpriteCharId = (typeof SPRITE_CHARACTERS)[number];

const STATUS_COLORS: Record<string, number> = {
  active: 0x4ade80,
  idle: 0xfacc15,
  offline: 0x6b7280,
};

export function Office({ agents }: OfficeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const agentSpritesRef = useRef<Map<string, AnimatedSprite | Sprite>>(new Map());
  const statusDotsRef = useRef<Map<string, Graphics>>(new Map());
  const nameLabelsRef = useRef<Map<string, Text>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initPixi = useCallback(async () => {
    if (!containerRef.current || appRef.current) return;

    try {
      const app = new Application({
        width: MAP_COLS * TILE_SIZE,
        height: MAP_ROWS * TILE_SIZE,
        backgroundColor: 0x1a1a2e,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: false,
      });

      appRef.current = app;
      containerRef.current.appendChild(app.view as HTMLCanvasElement);

      // Apply pixel-perfect rendering
      const canvas = app.view as HTMLCanvasElement;
      canvas.style.imageRendering = 'pixelated';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'contain';

      // --- Load assets ---
      // Tileset
      const tilesetTexture = await Assets.load('/assets/tiles/office-tileset.png');
      tilesetTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;

      const tilesetData = await fetch('/assets/tiles/office-tileset.json').then((r) => r.json());
      const tilesetSheet = new Spritesheet(tilesetTexture, tilesetData);
      await tilesetSheet.parse();

      // Furniture
      const furnitureTexture = await Assets.load('/assets/furniture/furniture.png');
      furnitureTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;

      const furnitureData = await fetch('/assets/furniture/furniture.json').then((r) => r.json());
      const furnitureSheet = new Spritesheet(furnitureTexture, furnitureData);
      await furnitureSheet.parse();

      // Character spritesheets
      const characterSheets: Record<string, Spritesheet> = {};
      for (const charId of SPRITE_CHARACTERS) {
        const charTexture = await Assets.load(`/assets/characters/${charId}/${charId}-idle.png`);
        charTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;

        const charData = await fetch(`/assets/characters/${charId}/${charId}-idle.json`).then((r) =>
          r.json()
        );
        const charSheet = new Spritesheet(charTexture, charData);
        await charSheet.parse();
        characterSheets[charId] = charSheet;
      }

      // --- Render layers ---
      const floorLayer = new Container();
      floorLayer.sortableChildren = false;
      const wallLayer = new Container();
      const furnitureLayer = new Container();
      const characterLayer = new Container();
      characterLayer.sortableChildren = true;
      const uiLayer = new Container();

      app.stage.addChild(floorLayer, wallLayer, furnitureLayer, characterLayer, uiLayer);

      // --- Render tilemap ---
      const floorTiles = new Set(['floor_1', 'floor_2', 'floor_3_wood', 'carpet']);

      for (let row = 0; row < MAP_ROWS; row++) {
        for (let col = 0; col < MAP_COLS; col++) {
          const tileIndex = TILE_MAP[row][col];
          const tileName = TILE_NAMES[tileIndex];
          const texture = tilesetSheet.textures[tileName];

          if (!texture) continue;

          const sprite = new Sprite(texture);
          sprite.x = col * TILE_SIZE;
          sprite.y = row * TILE_SIZE;

          if (floorTiles.has(tileName)) {
            floorLayer.addChild(sprite);
          } else {
            wallLayer.addChild(sprite);
          }
        }
      }

      // --- Render furniture ---
      for (const item of FURNITURE) {
        const texture = furnitureSheet.textures[item.type];
        if (!texture) continue;

        const sprite = new Sprite(texture);
        sprite.x = item.tileX * TILE_SIZE;
        sprite.y = item.tileY * TILE_SIZE;
        furnitureLayer.addChild(sprite);
      }

      // --- Place characters ---
      for (const desk of AGENT_DESKS) {
        const isSpriteChar = (SPRITE_CHARACTERS as readonly string[]).includes(desk.id);
        const pixelX = desk.tileX * TILE_SIZE + TILE_SIZE / 2;
        const pixelY = desk.tileY * TILE_SIZE + TILE_SIZE;

        if (isSpriteChar) {
          const sheet = characterSheets[desk.id as SpriteCharId];
          const animKey = `${desk.id}-idle`;
          const frames = sheet.animations[animKey];

          if (frames && frames.length > 0) {
            const animSprite = new AnimatedSprite(frames);
            animSprite.anchor.set(0.5, 1); // center-bottom
            animSprite.x = pixelX;
            animSprite.y = pixelY;
            animSprite.animationSpeed = 0.08; // ~5 FPS at 60 FPS ticker
            animSprite.play();
            animSprite.zIndex = desk.tileY;
            characterLayer.addChild(animSprite);
            agentSpritesRef.current.set(desk.id, animSprite);
          }
        } else {
          // Fallback: emoji text sprite for agents without pixel art
          const style = new TextStyle({
            fontSize: 20,
            fill: '#ffffff',
          });
          const text = new Text(desk.emoji, style);
          text.anchor.set(0.5, 1);
          text.x = pixelX;
          text.y = pixelY;
          text.zIndex = desk.tileY;
          characterLayer.addChild(text);
          agentSpritesRef.current.set(desk.id, text as unknown as Sprite);
        }

        // Name label below character
        const labelStyle = new TextStyle({
          fontSize: 7,
          fill: '#e2e8f0',
          fontFamily: 'monospace',
          align: 'center',
        });
        const label = new Text(desk.label, labelStyle);
        label.anchor.set(0.5, 0);
        label.x = pixelX;
        label.y = pixelY + 2;
        uiLayer.addChild(label);
        nameLabelsRef.current.set(desk.id, label);

        // Status dot
        const dot = new Graphics();
        dot.beginFill(STATUS_COLORS.offline);
        dot.drawCircle(0, 0, 3);
        dot.endFill();
        dot.x = pixelX + 12;
        dot.y = pixelY - TILE_SIZE + 4;
        uiLayer.addChild(dot);
        statusDotsRef.current.set(desk.id, dot);
      }

      setLoading(false);
    } catch (err) {
      console.error('PixiJS init error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setLoading(false);
    }
  }, []);

  // Init PixiJS
  useEffect(() => {
    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [initPixi]);

  // Update status dots when agent data changes
  useEffect(() => {
    for (const agent of agents) {
      const dot = statusDotsRef.current.get(agent.id);
      if (dot) {
        const color = STATUS_COLORS[agent.status] ?? STATUS_COLORS.offline;
        dot.clear();
        dot.beginFill(color);
        dot.drawCircle(0, 0, 3);
        dot.endFill();
      }

      // Pause animation for offline agents
      const sprite = agentSpritesRef.current.get(agent.id);
      if (sprite && sprite instanceof AnimatedSprite) {
        if (agent.status === 'offline') {
          sprite.stop();
          sprite.alpha = 0.5;
        } else {
          if (!sprite.playing) sprite.play();
          sprite.alpha = 1;
        }
      }
    }
  }, [agents]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#ef4444',
          fontFamily: 'monospace',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '2rem' }}>❌</div>
        <div>Failed to load office: {error}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        position: 'relative',
      }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: '1.5rem',
            zIndex: 10,
          }}
        >
          🏢 Loading Virtual Office...
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          lineHeight: 0,
        }}
      />
    </div>
  );
}
