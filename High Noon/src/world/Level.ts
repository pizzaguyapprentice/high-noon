import * as Phaser from 'phaser';

type Point = { x: number; y: number };

const LINE_OF_SIGHT_STEP = 8; 

export class Level {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly walls: Phaser.Tilemaps.TilemapLayer;

  constructor(scene: Phaser.Scene, key: string) {
    this.map = scene.make.tilemap({ key });
    const desertTiles = this.map.addTilesetImage('deserttile1', 'deserttiles', 32, 32);
    const wallTiles = this.map.addTilesetImage('walltile1', 'walltiles', 32, 32);
    if (!desertTiles || !wallTiles) {
      throw new Error(`Level "${key}": tileset images failed to load`);
    }
    const allTiles = [desertTiles, wallTiles];

    this.map.createLayer('Ground', allTiles);

    const walls = this.map.createLayer('Walls', allTiles) as Phaser.Tilemaps.TilemapLayer | null;
    if (!walls) {
      throw new Error(`Level "${key}" has no "Walls" layer`);
    }
    this.walls = walls;
    this.walls.setCollisionByProperty({ collides: true });

    scene.physics.world.setBounds(0, 0, this.width, this.height);
    scene.physics.world.TILE_BIAS = 32;
  }

  get width(): number {
    return this.map.widthInPixels;
  }

  get height(): number {
    return this.map.heightInPixels;
  }

  isWall(x: number, y: number): boolean {
    return !!this.walls.getTileAtWorldXY(x, y)?.collides;
  }

  findFreeSpot(margin = 24, maxAttempts = 500): Point {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const x = Phaser.Math.Between(margin, this.width - margin);
      const y = Phaser.Math.Between(margin, this.height - margin);
      if (!this.isWall(x, y)) {
        return { x, y };
      }
    }
    console.warn('Level.findFreeSpot: no free spot found, using map centre');
    return { x: this.width / 2, y: this.height / 2 };
  }

  hasLineOfSight(from: Point, to: Point): boolean {
    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const steps = Math.ceil(distance / LINE_OF_SIGHT_STEP);

    for (let step = 1; step < steps; step += 1) {
      const progress = step / steps;
      const x = Phaser.Math.Linear(from.x, to.x, progress);
      const y = Phaser.Math.Linear(from.y, to.y, progress);
      if (this.isWall(x, y)) {
        return false;
      }
    }
    return true;
  }
}