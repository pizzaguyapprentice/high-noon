import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';

const ENEMY_BULLET_LIFETIME = 3000;

export class Projectiles {
  readonly playerBullets: Phaser.Physics.Arcade.Group;
  readonly enemyBullets: Phaser.Physics.Arcade.Group;

  constructor(private scene: Phaser.Scene, walls: Phaser.Tilemaps.TilemapLayer) {
    this.playerBullets = scene.physics.add.group();
    this.enemyBullets = scene.physics.add.group();

    scene.physics.add.collider(this.playerBullets, walls, (bullet) => {
      scene.sound.play(`ricochet-${Phaser.Math.Between(1, 22)}`, { volume: 0.3 });
      (bullet as Phaser.GameObjects.Rectangle).destroy();
    });

    scene.physics.add.collider(this.enemyBullets, walls, (bullet) => {
      scene.sound.play(`ricochet-${Phaser.Math.Between(1, 22)}`, { volume: 0.3 });
      (bullet as Phaser.GameObjects.Rectangle).destroy();
    });
  }


  firePlayerBullet(fromX: number, fromY: number, targetX: number, targetY: number) {
    const speed = BALANCE.revolver.bulletSpeed;
    const bullet = this.scene.add.rectangle(fromX, fromY, 7, 7, 0x0);

    this.playerBullets.add(bullet);
    this.scene.physics.moveTo(bullet, targetX, targetY, speed);

    const travelTime = (Phaser.Math.Distance.Between(fromX, fromY, targetX, targetY) / speed) * 1000;
    this.scene.time.delayedCall(travelTime, () => {
      if (bullet.active) {
        this.land(bullet, targetX, targetY);
      }
    });
  }

  fireEnemyBullet(fromX: number, fromY: number, direction: Phaser.Math.Vector2) {
    const speed = BALANCE.enemy.bulletSpeed;
    const bullet = this.scene.add.rectangle(fromX, fromY, 6, 6, 0xffd000);

    this.enemyBullets.add(bullet);
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(direction.x * speed, direction.y * speed);

    this.scene.time.delayedCall(ENEMY_BULLET_LIFETIME, () => {
      if (bullet.active) {
        bullet.destroy();
      }
    });
  }

  private land(bullet: Phaser.GameObjects.Rectangle, x: number, y: number) {
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false; //once the bullet has landed it can't hit anything
    bullet.setPosition(x, y);

    const puff = this.scene.add.circle(x, y, 3, 0xd9c49a, 0.8);
    this.scene.tweens.add({
      targets: puff,
      scale: 3,
      alpha: 0,
      duration: 300,
      onComplete: () => puff.destroy(),
    });
    this.scene.tweens.add({
      targets: bullet,
      alpha: 0,
      scale: 0.5,
      duration: 200,
      onComplete: () => bullet.destroy(),
    });
  }
}