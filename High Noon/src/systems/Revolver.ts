import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';
import { ReloadBar } from '../ui/ReloadBar.ts';
import { Projectiles } from './Projectiles.ts';

export interface AmmoState {
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
}

export class Revolver {
  private ammo: number = BALANCE.revolver.maxAmmo;
  private reloading = false;
  private reloadTimer?: Phaser.Time.TimerEvent;
  private reloadStartedAt = 0;
  private reloadEndsAt = 0;
  private shotTimes: number[] = [];
  private reloadBar: ReloadBar;

  constructor(
    private scene: Phaser.Scene,
    private owner: { x: number; y: number },
    private projectiles: Projectiles,
    private onAmmoChanged: (state: AmmoState) => void,
  ) {
    this.reloadBar = new ReloadBar(scene, 0x2ecc71);
    this.notify();
  }

  get isReloading(): boolean {
    return this.reloading;
  }


  fire(targetX: number, targetY: number, spreadRadius: number): boolean {
    if (this.reloading) {
      if (this.ammo <= 0) {
        return false;
      }
      this.cancelReload();
    }
    if (this.ammo <= 0) {
      return false;
    }

    this.ammo -= 1;
    this.notify();

    const now = this.scene.time.now;
    this.shotTimes = this.shotTimes.filter(t => now - t < BALANCE.revolver.cursorCooldown);
    this.shotTimes.push(now);

    const angle = Phaser.Math.FloatBetween(0, 2 * Math.PI);
    const radius = spreadRadius * Math.sqrt(Math.random());
    const hitX = targetX + Math.cos(angle) * radius;
    const hitY = targetY + Math.sin(angle) * radius;

    this.scene.sound.play('sixshootershot', { volume: 0.2, detune: Phaser.Math.Between(-100, 100) });
    this.projectiles.firePlayerBullet(this.owner.x, this.owner.y, hitX, hitY);
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
    return baseSpread * distanceScale;
  }

  startReload() {
    if (this.reloading || this.ammo >= BALANCE.revolver.maxAmmo) {
      return;
    }
    this.reloading = true;
    this.reloadStartedAt = this.scene.time.now;
    this.reloadEndsAt = this.reloadStartedAt
      + (BALANCE.revolver.maxAmmo - this.ammo) * BALANCE.revolver.reloadPerBullet;
    this.notify();

    this.reloadTimer = this.scene.time.addEvent({
      delay: BALANCE.revolver.reloadPerBullet,
      loop: true,
      callback: () => {
        this.ammo += 1;
        this.scene.sound.play('sixshooterinsert', { volume: 0.2, detune: Phaser.Math.Between(-100, 100) });
        if (this.ammo >= BALANCE.revolver.maxAmmo) {
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
    this.ammo = Math.min(this.ammo + 1, BALANCE.revolver.maxAmmo);
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
      maxAmmo: BALANCE.revolver.maxAmmo,
      reloading: this.reloading,
    });
  }
}