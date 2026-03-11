/**
 * Office layout definition — 20x15 tile grid (32x32 tiles)
 * Total canvas: 640x480 pixels
 *
 * Tile legend:
 *   0 = floor_1        (default floor)
 *   1 = floor_2        (variation)
 *   2 = floor_3_wood   (wood floor)
 *   3 = wall_top
 *   4 = wall_side_left
 *   5 = wall_corner_tl
 *   6 = wall_corner_tr
 *   7 = cubicle_horizontal
 *   8 = cubicle_vertical
 *   9 = door
 *  10 = carpet
 */

export const TILE_SIZE = 32;
export const MAP_COLS = 20;
export const MAP_ROWS = 15;

// prettier-ignore
export const TILE_MAP: number[][] = [
  // Row 0 — top wall
  [5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6],
  // Row 1 — wall + yogi's corner office
  [4, 2, 2, 2, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 2, 2, 4],
  // Row 2 — yogi desk area + kitchen area + roni
  [4, 2, 2, 2, 8, 0, 10, 10, 0, 0, 0, 0, 0, 0, 0, 0, 8, 2, 2, 4],
  // Row 3 — cubicle dividers
  [4, 2, 2, 2, 8, 0, 10, 10, 0, 0, 0, 0, 0, 0, 0, 0, 8, 2, 2, 4],
  // Row 4 — corridor
  [4, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 4],
  // Row 5 — dev row top
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
  // Row 6 — dev cubicles: omer | noa | itai
  [4, 1, 1, 8, 1, 1, 8, 1, 1, 8, 1, 1, 8, 1, 1, 8, 1, 1, 1, 4],
  // Row 7 — dev row bottom
  [4, 1, 1, 8, 1, 1, 8, 1, 1, 8, 1, 1, 8, 1, 1, 8, 1, 1, 1, 4],
  // Row 8 — corridor
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
  // Row 9 — bottom section: dana | lior | meeting room
  [4, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 10, 10, 10, 10, 10, 10, 4],
  // Row 10
  [4, 1, 1, 8, 1, 1, 0, 0, 4, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 4],
  // Row 11
  [4, 1, 1, 8, 1, 1, 0, 0, 4, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 4],
  // Row 12 — bottom row: tomer | door
  [4, 0, 0, 0, 0, 0, 0, 0, 4, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 4],
  // Row 13
  [4, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 9, 7, 7, 0, 0, 0, 0, 0, 4],
  // Row 14 — bottom wall
  [5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6],
];

// Map tile index → spritesheet frame name
export const TILE_NAMES: Record<number, string> = {
  0: 'floor_1',
  1: 'floor_2',
  2: 'floor_3_wood',
  3: 'wall_top',
  4: 'wall_side_left',
  5: 'wall_corner_tl',
  6: 'wall_corner_tr',
  7: 'cubicle_horizontal',
  8: 'cubicle_vertical',
  9: 'door',
  10: 'carpet',
};

/**
 * Agent desk positions (tile coords → pixel coords calculated at runtime)
 * Each agent has a desk position + chair position
 */
export interface AgentDesk {
  id: string;
  tileX: number;
  tileY: number;
  label: string;
  emoji: string;
}

export const AGENT_DESKS: AgentDesk[] = [
  // Top section
  { id: 'yogi', tileX: 2, tileY: 2, label: 'יוגי', emoji: '🐻' },
  { id: 'roni', tileX: 17, tileY: 2, label: 'רוני', emoji: '📋' },

  // Dev row (row 6-7)
  { id: 'omer', tileX: 1, tileY: 6, label: 'עומר', emoji: '👨‍💻' },
  { id: 'noa', tileX: 4, tileY: 6, label: 'נועה', emoji: '🎨' },
  { id: 'itai', tileX: 7, tileY: 6, label: 'איתי', emoji: '🗄️' },
  { id: 'michal', tileX: 10, tileY: 6, label: 'מיכל', emoji: '🔍' },
  { id: 'gil', tileX: 13, tileY: 6, label: 'גיל', emoji: '⚙️' },

  // Bottom section
  { id: 'dana', tileX: 1, tileY: 10, label: 'דנה', emoji: '💜' },
  { id: 'lior', tileX: 4, tileY: 10, label: 'ליאור', emoji: '📈' },
  { id: 'tomer', tileX: 1, tileY: 12, label: 'תומר', emoji: '💼' },
];

/**
 * Furniture placements (desk + monitor per agent)
 */
export interface FurniturePlacement {
  type: 'desk' | 'chair' | 'monitor';
  tileX: number;
  tileY: number;
}

export const FURNITURE: FurniturePlacement[] = [
  // Yogi's office
  { type: 'desk', tileX: 2, tileY: 1 },
  { type: 'monitor', tileX: 2, tileY: 1 },
  { type: 'chair', tileX: 2, tileY: 2 },

  // Roni's office
  { type: 'desk', tileX: 17, tileY: 1 },
  { type: 'monitor', tileX: 17, tileY: 1 },
  { type: 'chair', tileX: 17, tileY: 2 },

  // Dev row desks
  { type: 'desk', tileX: 1, tileY: 6 },
  { type: 'monitor', tileX: 1, tileY: 6 },
  { type: 'chair', tileX: 1, tileY: 7 },

  { type: 'desk', tileX: 4, tileY: 6 },
  { type: 'monitor', tileX: 4, tileY: 6 },
  { type: 'chair', tileX: 4, tileY: 7 },

  { type: 'desk', tileX: 7, tileY: 6 },
  { type: 'monitor', tileX: 7, tileY: 6 },
  { type: 'chair', tileX: 7, tileY: 7 },

  { type: 'desk', tileX: 10, tileY: 6 },
  { type: 'monitor', tileX: 10, tileY: 6 },
  { type: 'chair', tileX: 10, tileY: 7 },

  { type: 'desk', tileX: 13, tileY: 6 },
  { type: 'monitor', tileX: 13, tileY: 6 },
  { type: 'chair', tileX: 13, tileY: 7 },

  // Bottom section
  { type: 'desk', tileX: 1, tileY: 10 },
  { type: 'monitor', tileX: 1, tileY: 10 },
  { type: 'chair', tileX: 1, tileY: 11 },

  { type: 'desk', tileX: 4, tileY: 10 },
  { type: 'monitor', tileX: 4, tileY: 10 },
  { type: 'chair', tileX: 4, tileY: 11 },
];
