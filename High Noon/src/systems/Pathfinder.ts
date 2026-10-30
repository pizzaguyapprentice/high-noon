import * as Phaser from 'phaser';
import * as EasyStar from 'easystarjs';
export class Pathfinder {
  private easystar = new EasyStar.js();
  private tileSize: number;

  constructor(private layer: Phaser.Tilemaps.TilemapLayer) {
    this.tileSize = layer.layer.tileWidth;

    // 0 is walkable 1 is walls
    const grid: number[][] = [];

    for (let y = 0; y < layer.layer.height; y++) {
      const row: number[] = [];

      for (let x = 0; x < layer.layer.width; x++) {
        const tile = layer.getTileAt(x, y);
        row.push(tile && tile.collides ? 1 : 0);
      }
      grid.push(row);
    }
    this.easystar.setGrid(grid);
    this.easystar.setAcceptableTiles([0]);
    this.easystar.enableDiagonals();
    this.easystar.disableCornerCutting(); 
    this.easystar.setIterationsPerCalculation(1000); 
  }

  findPath(fromX: number, fromY: number,toX: number, toY: number,onDone: (path: Phaser.Math.Vector2[] | null) => void) {
    const startX = Math.floor(fromX / this.tileSize);
    const startY = Math.floor(fromY / this.tileSize);
    const endX = Math.floor(toX / this.tileSize);
    const endY = Math.floor(toY / this.tileSize);

    this.easystar.findPath(startX, startY, endX, endY, (path) => {
      if (!path) {
        onDone(null);
        return;
      }
  
      onDone(path.map(p => new Phaser.Math.Vector2(
        p.x * this.tileSize + this.tileSize / 2,
        p.y * this.tileSize + this.tileSize / 2
      )));
    });
  }
  update() {
    this.easystar.calculate();
  }
}