import * as Phaser from 'phaser';

export interface MapSpawn{
  x:number;
  y:number;
  size?:number;
}

type Point = { x: number; y: number };

const LINE_OF_SIGHT_STEP = 8; 

export class Level {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly walls: Phaser.Tilemaps.TilemapLayer;
  

  constructor(scene: Phaser.Scene, key: string) {

    this.map = scene.make.tilemap({key});
    const allTiles: Phaser.Tilemaps.Tileset[] = [];

    for (const tileset of this.map.tilesets) {
      const added = this.map.addTilesetImage(tileset.name);
      if (!added) {
        throw new Error(`Level "${key}": no image loaded for tileset "${tileset.name}"`);
      }
      allTiles.push(added);
    }

    this.map.createLayer('Ground', allTiles);

    const walls = this.map.createLayer('Walls', allTiles) as Phaser.Tilemaps.TilemapLayer | null;
    if (!walls) {
      throw new Error(`Level "${key}" has no "Walls" layer`);
    }

    this.walls = walls;
    this.walls.setCollisionByProperty({ collides: true });
    this.walls.setCollisionByExclusion([-1]);

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

  getSpawns(kind: string): MapSpawn[]{
    const layer = this.map.getObjectLayer("Spawns");
    if(!layer){
      return [];
    }
    return layer.objects.filter((obj) => obj.name === kind).map((obj)=>{
      const x = (obj.x ?? 0) + (obj.point ? 0 : (obj.width ?? 0)/2);
      const y = (obj.y ?? 0) + (obj.point ? 0 : (obj.height ?? 0)/2);
      return {x,y,size: readNumberProperty(obj, "size")};
    });
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
function readNumberProperty(obj: Phaser.Types.Tilemaps.TiledObject, name: string): number | undefined {
  const props = obj.properties as { name: string; value: unknown }[] | undefined;
  const value = props?.find((p)=>p.name === name)?.value;
  return typeof value === 'number' ? value:undefined;
}