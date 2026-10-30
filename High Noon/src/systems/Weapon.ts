import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';
import { ReloadBar } from '../ui/ReloadBar.ts';
import { Projectiles } from './Projectiles.ts';

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
  private gun = 'revolver';
  private shotDelay = 0; 

  constructor(
    private scene: Phaser.Scene,
    private owner: { x: number; y: number },
    private projectiles: Projectiles,
    private onAmmoChanged: (state: AmmoState) => void,
  ) {
    this.reloadBar = new ReloadBar(scene, 0x2ecc71);
    this.notify();
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
    if (this.savedAmmo[name] === undefined) {
      this.ammo = this.maxAmmo;
    } else {
      this.ammo = this.savedAmmo[name];
    }
    this.notify();
  }

  private get maxAmmo(): number {
    if (this.equipedGun === 'shotgun') {
      return 2;
    }
    if (this.equipedGun === 'rifle') {
      return 8;
    }
    return BALANCE.revolver.maxAmmo;
  }

  get isReloading(): boolean {
    return this.reloading;
  }


  fire(targetX: number, targetY: number, spreadRadius: number): boolean {
  
    if(this.scene.time.now < this.shotDelay){
      return false;
    }

    if (this.reloading) {
      if (this.ammo <= 0) {
        return false;
      }
      this.cancelReload();
    }
    if (this.ammo <= 0) {
      return false;
    }

    let speed: number = BALANCE.revolver.bulletSpeed;

    if(this.equipedGun === 'rifle'){
      speed = 2000;
      this.shotDelay = this.scene.time.now + 500;
    }

    this.ammo -= 1;
    this.notify();

    const now = this.scene.time.now;
    this.shotTimes = this.shotTimes.filter(t => now - t < BALANCE.revolver.cursorCooldown);
    this.shotTimes.push(now);
    let pelletCount = 1;
    if (this.equipedGun === 'shotgun') {
      this.shotDelay = this.scene.time.now + 1000;
      pelletCount = 5;
    }
    
    
    for (let i = 0; i < pelletCount; i++) {
      const x = targetX + Phaser.Math.Between(-spreadRadius, spreadRadius);
      const y = targetY + Phaser.Math.Between(-spreadRadius, spreadRadius);

      this.projectiles.firePlayerBullet(this.owner.x, this.owner.y, x, y, speed);
    }

    this.scene.sound.play('sixshootershot', { volume: 0.2 });
    return true;
  }

  getSpread(distance: number): number {
    const now = this.scene.time.now;
    const recentShots = this.shotTimes.filter(t => now - t < BALANCE.revolver.cursorCooldown).length;
    const baseSpread = Math.min(
      BALANCE.revolver.minSpread + recentShots * BALANCE.revolver.spreadPerShot,
      BALANCE.revolver.maxSpread,
    );
    const distanceScale = Phaser.Math.Clamp(
      distance / BALANCE.revolver.range,
      BALANCE.revolver.minCircleScale,
      BALANCE.revolver.maxCircleScale,
    );
    if (this.equipedGun === 'rifle') {
      return baseSpread * distanceScale / 3;
    }
    if (this.equipedGun === 'shotgun') {
      return baseSpread * distanceScale * 2;
    }
    return baseSpread * distanceScale;
  }

  startReload() {
    if (this.reloading || this.ammo >= this.maxAmmo) {
      return;
    }
    this.reloading = true;
    this.reloadStartedAt = this.scene.time.now;
    this.reloadEndsAt = this.reloadStartedAt
      + (this.maxAmmo - this.ammo) * BALANCE.revolver.reloadPerBullet;
    this.notify();

    this.reloadTimer = this.scene.time.addEvent({
      delay: BALANCE.revolver.reloadPerBullet,
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
    this.ammo = Math.min(this.ammo + 1, this.maxAmmo);
    this.notify();
  }

  update() {
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
