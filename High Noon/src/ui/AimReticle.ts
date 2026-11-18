import * as Phaser from 'phaser';
import { Weapon } from '../systems/Weapon.ts';

export class AimReticle {
  private currentRadius = 0;
  readonly cone: Phaser.GameObjects.Graphics;
  readonly aim = new Phaser.Math.Vector2(); 

  constructor(
    private scene: Phaser.Scene,
    private owner: { x: number; y: number },
    private weapon: Weapon,)
    {
    //Cone is a GameObject.Graphics
    this.cone = scene.add.graphics().setDepth(10);
    //Setting the cursor
    scene.input.setDefaultCursor('crosshair');

    }
    get radius(): number {
      return this.currentRadius;
    }

  update() {
    const pointer = this.scene.input.activePointer;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.aim.set(world.x,world.y);

    let distance = Phaser.Math.Distance.Between(this.owner.x, this.owner.y, this.aim.x, this.aim.y);
    
    //If the cursor is to close, clamp the reticle the distance (60px)
    const clampDistance = 100;
    if(distance < clampDistance){
      const angle = Phaser.Math.Angle.Between(this.owner.x,this.owner.y, world.x, world.y);
      this.aim.set(this.owner.x + Math.cos(angle)*clampDistance, this.owner.y + Math.sin(angle)*clampDistance);
      distance = 100;
    }
    //getSpread function is in weapon.ts, so that the actually drawn cone matches the bullet range
    const targetRadius = this.weapon.getSpread(distance);
    //Linearily change the radius for a nicer look
    this.currentRadius = Phaser.Math.Linear(this.currentRadius, targetRadius, 0.2);
    //draw the cone with the distance between the player and the pointer
    this.drawCone(distance);
  }

  private drawCone(distance: number){
    const cone = this.cone;
    cone.clear();

    const playerx = this.owner.x;
    const playery = this.owner.y;
    //Direction vectors
    const direcitonx = (this.aim.x-playerx) / distance;
    const directiony = (this.aim.y-playery) / distance;
    //perpendicular lines
    const perpx = -directiony;
    const perpy = direcitonx;

    //edges of the cone
    const edge = (distanceAlong:number, side:number) =>{

      //direction is based off of player position
      const centerx = playerx + direcitonx * distanceAlong;
      const centery = playery + directiony * distanceAlong;
      // ranges from 0-1
      const progress = distanceAlong/distance;
      const halfWidth = this.currentRadius*progress;

      const edgex = centerx + perpx * halfWidth * side;
      const edgey = centery + perpy * halfWidth * side;

      return new Phaser.Math.Vector2(edgex,edgey);

    };
    //Draws a rectangle with using four points
    const band = (from:number, to:number, alpha:number)=>{
      const nearleft = edge(from,-1);
      const farleft = edge(to,-1);
      const farright = edge(to, 1);
      const nearright = edge(from, 1);
      cone.fillStyle(0xff0000,alpha);
      cone.fillPoints([nearleft,farleft,farright,nearright], true);
    };


    const end = distance ;
    const start = distance * 0.6;
    const length = end - start;
    for (let i = 0; i < 16; i++) {
      const from = start+(length*i)/ 16;
      const to = start+(length*(i+1))/ 16;
      band(from, to,0.2 *((i+1)/ 16));
    }
    
    const lineCenter = edge(end, 0);                         
    const lineRadius = this.currentRadius*(end/distance);
    const aimAngle = Math.atan2(directiony, direcitonx);

    cone.fillStyle(0xff0000, 0.2);
    cone.slice(lineCenter.x, lineCenter.y, lineRadius, aimAngle - Math.PI / 2, aimAngle + Math.PI / 2, false);
    cone.fillPath();

  }
}