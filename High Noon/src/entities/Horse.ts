import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';

export type Gait = 'stand' | 'walk' | 'trot' | 'canter' | 'gallop';

const GAITS: Gait[] = ['stand', 'walk', 'trot', 'canter', 'gallop'];
//hoofbeat playback speed: slowest at a walk, fastest at a gallop
const hoofrateslow = 0.6;
const hoofratefast = 1.6;
const hoofvolume = 0.3;

export class Horse extends Phaser.GameObjects.Rectangle {
  declare body: Phaser.Physics.Arcade.Body;

  owned = false;
  isRidden = false;

  private gaitIndex = 0;
  // direction the horse faces in radians
  private heading = 0;  
  //eases toward the gaits speed instead of jumping
  private currentSpeed = 0; 
  private keys: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private hooves: Phaser.Sound.WebAudioSound;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 30, 14, 0x8b5a2b);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    //circle body stays correct however the rectangle is rotated
    this.body.setCircle(9, this.width/2-9, this.height / 2 - 9);
    this.body.setCollideWorldBounds(true);
    this.setDepth(4);

    this.keys = scene.input.keyboard!.addKeys('W,A,S,D') as Record<'W'|'A'|'S'|'D', Phaser.Input.Keyboard.Key>;

    //hooves are always playing, but silent
    this.hooves = scene.sound.add('horsego',{ loop: true, volume: 0 })as Phaser.Sound.WebAudioSound;

    //so stop this one when the scene ends
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN,() => this.hooves.destroy());
  }

  get gait(): Gait {
    return GAITS[this.gaitIndex];
  }

  mount() {
    this.isRidden = true;
    this.gaitIndex = 0;
    this.currentSpeed = 0;
    this.body.stop();
    this.body.enable = false;
    this.hooves.play();
  }

  dismount() {
    this.isRidden = false;
    this.gaitIndex = 0;
    this.currentSpeed = 0;
    this.body.enable = true;
    this.body.reset(this.x, this.y);
    this.hooves.stop();
  }

  ride(delta: number, rider: Phaser.Physics.Arcade.Body) {
    const dt = delta / 1000;

    if (Phaser.Input.Keyboard.JustDown(this.keys.W)) {
      this.gaitIndex = Math.min(this.gaitIndex + 1, GAITS.length - 1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.S)) {
      this.gaitIndex = Math.max(this.gaitIndex - 1, 0);
    }

    const turn = Number(this.keys.D.isDown) - Number(this.keys.A.isDown);
    this.heading += turn * BALANCE.horse.turnRates[this.gait] * dt;

    const targetSpeed = BALANCE.horse.speeds[this.gait];
    if (this.currentSpeed < targetSpeed) {
      this.currentSpeed = Math.min(this.currentSpeed+BALANCE.horse.acceleration*dt, targetSpeed);
    } else {
      this.currentSpeed = Math.max(this.currentSpeed-BALANCE.horse.deceleration*dt, targetSpeed);
    }

    if (!rider.blocked.none && this.gaitIndex > 1) {
      this.gaitIndex = 1;
      this.currentSpeed = Math.min(this.currentSpeed, BALANCE.horse.speeds.walk);
    }

    this.scene.physics.velocityFromRotation(this.heading, this.currentSpeed, rider.velocity);
    this.setRotation(this.heading);
    this.updateHooves();
  }

  idle() {
    this.body.setVelocity(0, 0);
  }

  private updateHooves() {
    const progress = this.currentSpeed/BALANCE.horse.speeds.gallop;
    this.hooves.setRate(Phaser.Math.Linear(hoofrateslow, hoofratefast, progress));
    this.hooves.setVolume(progress>0.05?hoofvolume : 0);
  }
}