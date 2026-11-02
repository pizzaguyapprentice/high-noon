import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';
import { ReloadBar } from '../ui/ReloadBar.ts';
import { Projectiles } from './Projectiles.ts';

export interface AmmoState {
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  selectedSlot: number;
  slots: HotbarSlot[];
}

export interface HotbarSlot {
  item: 'revolver' | 'dynamite';
  label: string;
  ammo: number;
  maxAmmo: number;
}

export class Weapon {
  readonly slots: HotbarSlot[] = [
    { item: 'revolver', label: 'revolver', ammo: BALANCE.revolver.maxAmmo, maxAmmo: BALANCE.revolver.maxAmmo },
    { item: 'revolver', label: 'revolver', ammo: BALANCE.revolver.maxAmmo, maxAmmo: BALANCE.revolver.maxAmmo },
    { item: 'revolver', label: 'revolver', ammo: BALANCE.revolver.maxAmmo, maxAmmo: BALANCE.revolver.maxAmmo },
    { item: 'revolver', label: 'revolver', ammo: BALANCE.revolver.maxAmmo, maxAmmo: BALANCE.revolver.maxAmmo },
    { item: 'dynamite', label: 'dynamite', ammo: 3, maxAmmo: 3 },
  ];

  private selectedSlot = 0;
  private reloading = false;
  private reloadTimer?: Phaser.Time.TimerEvent;
  private reloadStartedAt = 0;
  private reloadEndsAt = 0;
  private shotTimes: number[] = [];
  private reloadBar: ReloadBar;
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
    return this.currentSlot.item;
  }

  get currentSlot(): HotbarSlot {
    return this.slots[this.selectedSlot];
  }

  get currentSlotIndex(): number {
    return this.selectedSlot;
  }

  selectSlot(index: number) {
    if (index < 0 || index >= this.slots.length || index === this.selectedSlot) {
      return;
    }
    this.cancelReload();
    this.selectedSlot = index;
    this.notify();
  }

  cycleSlot(direction: 1 | -1) {
    const nextSlot = (this.selectedSlot + direction + this.slots.length) % this.slots.length;
    this.selectSlot(nextSlot);
  }

  get isReloading(): boolean {
    return this.reloading;
  }

  consumeDynamite(): boolean {
    if (this.currentSlot.item !== 'dynamite' || this.currentSlot.ammo <= 0) {
      return false;
    }
    this.currentSlot.ammo -= 1;
    this.notify();
    return true;
  }

  fire(targetX: number, targetY: number, spreadRadius: number): boolean {
    if (this.currentSlot.item !== 'revolver') {
      return false;
    }

    if(this.scene.time.now < this.shotDelay){
      return false;
    }

    if (this.reloading) {
      if (this.currentSlot.ammo <= 0) {
        return false;
      }
      this.cancelReload();
    }
    if (this.currentSlot.ammo <= 0) {
      return false;
    }

    const speed: number = BALANCE.revolver.bulletSpeed;

    this.currentSlot.ammo -= 1;
    this.notify();

    const now = this.scene.time.now;
    this.shotTimes = this.shotTimes.filter(t => now - t < BALANCE.revolver.cursorCooldown);
    this.shotTimes.push(now);
    for (let i = 0; i < 1; i++) {
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
    return baseSpread * distanceScale;
  }

  startReload() {
    if (this.currentSlot.item !== 'revolver' || this.reloading || this.currentSlot.ammo >= this.currentSlot.maxAmmo) {
      return;
    }
    this.reloading = true;
    this.reloadStartedAt = this.scene.time.now;
    this.reloadEndsAt = this.reloadStartedAt
      + (this.currentSlot.maxAmmo - this.currentSlot.ammo) * BALANCE.revolver.reloadPerBullet;
    this.notify();

    this.reloadTimer = this.scene.time.addEvent({
      delay: BALANCE.revolver.reloadPerBullet,
      loop: true,
      callback: () => {
        this.currentSlot.ammo += 1;
        this.scene.sound.play('sixshooterinsert', { volume: 0.2, detune: Phaser.Math.Between(-100, 100) });
        if (this.currentSlot.ammo >= this.currentSlot.maxAmmo) {
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
    if (this.currentSlot.item === 'revolver') {
      this.currentSlot.ammo = Math.min(this.currentSlot.ammo + 1, this.currentSlot.maxAmmo);
    }
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
      ammo: this.currentSlot.ammo,
      maxAmmo: this.currentSlot.maxAmmo,
      reloading: this.reloading,
      selectedSlot: this.selectedSlot,
      slots: this.slots,
    });
  }
}
