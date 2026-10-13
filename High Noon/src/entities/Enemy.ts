import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { ReloadBar } from '../ui/ReloadBar';

/**
 * A single outlaw. Owns its own firing rhythm, clip, reload timer and reload bar.
 * The scene still decides *where* bullets go; the enemy decides *when* it may fire.
 */
export class Enemy extends Phaser.GameObjects.Rectangle {
  declare body: Phaser.Physics.Arcade.Body;

  private nextShotAt: number;
  private shotsFired = 0;
  private reloadUntil = 0;
  private reloadBar: ReloadBar;

  constructor(scene: Phaser.Scene, x: number, y: number, size = 16) {
    super(scene, x, y, size, size, 0xff2020);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setCollideWorldBounds(true);

    this.reloadBar = new ReloadBar(scene, 0xe74c3c);
    //Stagger the first shot so enemies don't all fire on the same frame
    this.nextShotAt = scene.time.now + Phaser.Math.Between(0, BALANCE.enemy.fireInterval);
  }

  chase(target: { x: number; y: number }, kills: number) {
    const bonus = Math.min(kills, BALANCE.enemy.killScalingCap) * BALANCE.enemy.speedPerKill;
    this.scene.physics.moveTo(this, target.x, target.y, BALANCE.enemy.speed + bonus);
  }

  isReadyToFire(now: number): boolean {
    return this.active && now >= this.nextShotAt;
  }

  registerShot(now: number, kills: number) {
    this.shotsFired += 1;

    if (this.shotsFired >= BALANCE.enemy.clipSize) {
      this.shotsFired = 0;
      this.reloadUntil = now + BALANCE.enemy.reloadTime;
      this.nextShotAt = this.reloadUntil;
      return;
    }

    const fasterBy = Math.min(kills, BALANCE.enemy.killScalingCap) * BALANCE.enemy.fireIntervalPerKill;
    this.nextShotAt = now + BALANCE.enemy.fireInterval - fasterBy;
  }

  updateReloadBar(now: number) {
    const remaining = this.reloadUntil - now;
    if (remaining > 0) {
      this.reloadBar.show(this.x, this.y, 1 - remaining / BALANCE.enemy.reloadTime, remaining);
    } else {
      this.reloadBar.hide();
    }
  }

  destroy(fromScene?: boolean) {
    this.reloadBar?.destroy();
    super.destroy(fromScene);
  }
}