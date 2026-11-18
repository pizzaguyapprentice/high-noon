import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';
import { ReloadBar } from '../ui/ReloadBar.ts';
import { Projectiles } from './Projectiles.ts';

interface WeaponStats {
  damage: number;
  maxAmmo: number;
  reloadPerBullet: number;
  bulletSpeed: number;
  fireDelay: number;
  pellets: number;
  minSpread: number;
  spreadPerShot: number;
  maxSpread: number;
  cursorCooldown: number;
  minCircleScale: number;
  maxCircleScale: number;
  range: number;
  movementPenalty: number;
}

export interface AmmoState {
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
}

export class Weapon {
  private ammo: number = BALANCE.revolver.maxAmmo;
  private savedAmmo: { [gun: string]: number } = {};
  private reloading = false;
  private reloadTimer?: Phaser.Time.TimerEvent;
  private reloadStartedAt = 0;
  private reloadEndsAt = 0;
  private shotTimes: number[] = [];
  private reloadBar: ReloadBar;
  private gun = "revolver";
  private shotDelay = 0;
  private lastPositionX = 0;
  private lastPositionY = 0;
  private isMoving = false;
  private lastMovedAt = 0;


  constructor(
    private scene: Phaser.Scene,
    private owner: { x: number; y: number },
    private projectiles: Projectiles,
    private onAmmoChanged: (state: AmmoState) => void,
  ) 
  {
    this.reloadBar = new ReloadBar(scene, 0x2ecc71);
    this.lastPositionX = owner.x;
    this. lastPositionY = owner.y;
    this.notify();
  }
  private get stats(): WeaponStats{
    switch (this.gun) {
      case "rifle":
        return BALANCE.rifle;
      case "shotgun":
        return BALANCE.shotgun;
      default:
        return BALANCE.revolver;
    }
  }
  get equipedGun(): string {
    return this.gun;
  }

  set equipedGun(name: string) {
    if (this.gun === name) {
      return;
    }
    this.cancelReload();
    this.savedAmmo[this.gun] = this.ammo;
    this.gun = name;
    this.shotTimes = [];

    if (this.savedAmmo[name] === undefined) {
      this.ammo = this.maxAmmo;
    }
    else{
      this.ammo = this.savedAmmo[name];
    }
    this.notify();
  }

  private get maxAmmo(): number {
    if (this.equipedGun === "dynamite") {
      return 3;
    }
    else{
      return this.stats.maxAmmo;
    }
  }
  get isReloading(): boolean {
    return this.reloading;
  }


  consumeDynamite(): boolean {
    if (this.equipedGun !== 'dynamite' || this.ammo <= 0) {
      return false;
    }
    this.ammo -= 1;
    this.notify();
    return true;
  }

  fire(targetX: number, targetY: number, spreadRadius: number): boolean {
    const {bulletSpeed,damage,pellets,fireDelay,cursorCooldown} = this.stats;
    //not shooting dynamtie
    if (this.equipedGun === 'dynamite') {
      return false;
    }
    //Cannot shoot while waiting for the weapon delay to end
    const now = this.scene.time.now;
    
    if(now < this.shotDelay){
      return false;
    }

    //Cancel reload if the player shoots
    if (this.reloading) {
      if (this.ammo <= 0) {
        return false;
      }
      this.cancelReload();
    }
    
    //Cannot shoot while no ammo
    if (this.ammo <= 0) {
      return false;
    }
    this.shotDelay = this.scene.time.now + fireDelay;

    
    //Coords of where bullet starts
    const from = new Phaser.Math.Vector2(this.owner.x, this.owner.y);
    //Coords of where bullet ends 
    const target = new Phaser.Math.Vector2(targetX, targetY);
    //Line between cursor and player
    const direction = target.clone().subtract(from).normalize();

    //creating the circle at the end.
    const coneCenter =  target.clone();
    //Taken from getSpread, value is in pixels
    const coneRadius = spreadRadius;

    // queue up the shots for the reticle to decrease in size after expanding.
    this.shotTimes = this.shotTimes.filter(t => now - t < cursorCooldown);
    this.shotTimes.push(now);
    this.ammo -= 1;
    this.notify();

    
    for (let i = 0; i < pellets; i++) {
      //In radians, picks an angle in the 180 degree semicircle
      const angle = Phaser.Math.FloatBetween(-Math.PI/2,Math.PI/2);
      //trueArea prevents grouping up of shots in the center because of r^2
      const trueArea = coneRadius * Math.sqrt(Math.random());
      //Clones the Coords of target, gives vector with the angle and scales the randomization with trueArea
      const landing = coneCenter.clone().add(direction.clone().rotate(angle).scale(trueArea));

      this.projectiles.firePlayerBullet(from.x, from.y, landing.x, landing.y, bulletSpeed, damage);
    }
    //Audio for shooting
    this.scene.sound.play('sixshootershot', { volume: 0.2 });

    return true;
  }

  getSpread(distance: number): number {
    const {minSpread, spreadPerShot, maxSpread, cursorCooldown, minCircleScale, maxCircleScale, range} = this.stats;

    const now = this.scene.time.now;
    //list of timestamps, in miliseconds from the moment each shot was fired., how many of those
    const recentShots = this.shotTimes.filter(t => now - t < cursorCooldown).length;
    //Calculate spread based on recent shots, is in pixels
    const baseSpread = Math.min(minSpread + (recentShots*spreadPerShot),maxSpread);
    //Each weapon has range, past the range point, the spread gets larger, before the range point, the spread gets smaller
    const distanceScale = Phaser.Math.Clamp(distance/range, minCircleScale,maxCircleScale);
    if(this.isMoving){
      return baseSpread * distanceScale * this.stats.movementPenalty;
    }
    else{
      return baseSpread * distanceScale;
    }
  }

  startReload() {
    if (this.equipedGun === 'dynamite' || this.reloading || this.ammo >= this.maxAmmo) {
      return;
    }
    const {reloadPerBullet} = this.stats
    this.reloading = true;
    this.reloadStartedAt = this.scene.time.now;
    this.reloadEndsAt = this.reloadStartedAt + (this.maxAmmo - this.ammo) * reloadPerBullet;
    this.notify();

    this.reloadTimer = this.scene.time.addEvent({
      delay: reloadPerBullet,
      loop: true,
      callback: () => {
        this.ammo += 1;
        this.scene.sound.play('sixshooterinsert', { volume: 0.2, detune: Phaser.Math.Between(-100, 100) });
        if (this.ammo >= this.maxAmmo) {
          this.endReload();
        } else {
          this.notify();
        }
      },
    });
  }

  cancelReload() {
    if (this.reloading) {
      this.endReload();
    }
  }

  addRound() {
    if (this.equipedGun === 'dynamite') {
      return;
    }
    this.ammo = Math.min(this.ammo + 1, this.maxAmmo);
    this.notify();
  }

  update() {
    //Tracking for playermovement to apply movement penalty
    const now = this.scene.time.now;

    if (this.owner.x !== this.lastPositionX || this.owner.y !== this.lastPositionY) {
      this.lastMovedAt = now;
    }
    
    this.lastPositionX = this.owner.x;
    this.lastPositionY = this.owner.y;
    this.isMoving = now-this.lastMovedAt<100;
    
    if (!this.reloading) {
      this.reloadBar.hide();
      return;
    }
    const duration = Math.max(this.reloadEndsAt - this.reloadStartedAt, 1);
    const remaining = Math.max(this.reloadEndsAt - this.scene.time.now, 0);
    

    this.reloadBar.show(this.owner.x, this.owner.y, 1 - remaining / duration, remaining);
  }

  private endReload() {
    this.reloading = false;
    this.reloadTimer?.remove();
    this.reloadTimer = undefined;
    this.notify();
    this.scene.sound.play('sixshootercylinder', { volume: 0.2, detune: Phaser.Math.Between(-100, 100) });
  }

  private notify() {
    this.onAmmoChanged({
      ammo: this.ammo,
      maxAmmo: this.maxAmmo,
      reloading: this.reloading,
    });
  }
}
