import * as Phaser from 'phaser';
import { Weapon } from '../systems/Weapon.ts';

const SMOOTHING = 0.2;


export class AimReticle {
  circle: Phaser.GameObjects.Arc;
  private currentRadius = 0;

  constructor(
    private scene: Phaser.Scene,
    private owner: { x: number; y: number },
    private weapon: Weapon,
  ) {
    this.circle = scene.add.circle(0, 0, 0, 0xff0000, 0.25)
      .setStrokeStyle(1, 0xff0000, 0.5)
      .setDepth(10);
    scene.input.setDefaultCursor('crosshair');
  }

  get radius(): number {
    return this.currentRadius;
  }

  update() {
    const pointer = this.scene.input.activePointer;
    const distance = Phaser.Math.Distance.Between(this.owner.x, this.owner.y, pointer.worldX, pointer.worldY);
    const targetRadius = this.weapon.getSpread(distance);

    this.currentRadius = Phaser.Math.Linear(this.currentRadius, targetRadius, SMOOTHING);
    this.circle.setRadius(this.currentRadius);
    this.circle.setPosition(pointer.worldX, pointer.worldY);
  }
}