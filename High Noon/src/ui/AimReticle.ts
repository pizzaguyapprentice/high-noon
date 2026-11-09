import * as Phaser from 'phaser';
import { Weapon } from '../systems/Weapon.ts';

const SMOOTHING = 0.2;


export class AimReticle {
  //circle: Phaser.GameObjects.Arc;
  private currentRadius = 0;
  readonly cone: Phaser.GameObjects.Graphics;
  readonly aim = new Phaser.Math.Vector2(); 
  

  constructor(

    private scene: Phaser.Scene,
    private owner: { x: number; y: number },
    private weapon: Weapon,)
    {
    this.cone = scene.add.graphics().setDepth(10);
    //this.circle = scene.add.circle(0, 0, 0, 0xff0000, 0.25)
    //.setStrokeStyle(1, 0xff0000, 0.5)
    //.setDepth(10);
    scene.input.setDefaultCursor('crosshair');
    }
    get radius(): number {
      return this.currentRadius;
    }

  update() {
    const pointer = this.scene.input.activePointer;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.aim.set(world.x,world.y);

    const distance = Phaser.Math.Distance.Between(this.owner.x, this.owner.y, this.aim.x, this.aim.y);
    const targetRadius = this.weapon.getSpread(distance);
    this.currentRadius = Phaser.Math.Linear(this.currentRadius, targetRadius, SMOOTHING);
    this.drawCone(distance);
    
    //this.circle.setRadius(this.currentRadius);
    //this.circle.setPosition(pointer.worldX, pointer.worldY);
  }

  private drawCone(distance: number){
    const cone = this.cone;
    cone.clear();

    const playerx = this.owner.x;
    const playery = this.owner.y;
    const direcitonx = (this.aim.x - playerx) / distance;
    const directiony = (this.aim.y - playery) / distance;
    //perpendicular lines
    const perpx = -directiony;
    const perpy = direcitonx;


    const edge = (intersect:number, side:number) =>{

      const centerx = playerx + direcitonx * intersect;
      const centery = playery + directiony * intersect;

      //between 0 and the cursor
      const completion = intersect/distance;
      const halfwidth = this.currentRadius*completion;

      const edgex = centerx + perpx * halfwidth * side;
      const edgey = centery + perpy * halfwidth * side;

      return new Phaser.Math.Vector2(edgex,edgey);

    };

    const band = (from:number, to:number, alpha:number)=>{
      const nearleft = edge(from,-1);
      const farleft = edge(to,-1);
      const farright = edge(to, 1);
      const nearright = edge(from, 1);
      cone.fillStyle(0xff0000,alpha);
      cone.fillPoints([nearleft,farleft,farright,nearright], true);
    };

    //20 pixels overshoot

    const overshoot =  30;
    const end = distance + overshoot;
    //60% of the cone
    const start = distance * 0.6;
    const length = end - start;
    for (let i = 0; i < 16; i++) {
      const from = start+(length*i)/ 16;
      const to = start+(length*(i+1))/ 16;
      band(from, to,0.2 *((i+1)/ 16));
    }
    
    const left = edge(distance,-1);
    const right = edge(distance, 1);
    cone.lineStyle(2,0xff0000,0.2);
    cone.lineBetween(left.x,left.y,right.x,right.y);
  }
}