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


  firePlayerBullet(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    speed: number,
    damage: number,
  ) {
    const bullet = this.scene.add.rectangle(fromX, fromY, 7, 7, 0x0);
    bullet.setData('damage', damage);

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
    bullet.setData('damage', BALANCE.enemy.bulletDamage);

    this.enemyBullets.add(bullet);
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(direction.x * speed, direction.y * speed);

    this.scene.time.delayedCall(ENEMY_BULLET_LIFETIME, () => {
      if (bullet.active) {
        bullet.destroy();
      }
    });
  }

  tracePlayerBullets(
    targets: Phaser.Physics.Arcade.Group,
    onHit: (target: Phaser.GameObjects.GameObject, bullet: Phaser.GameObjects.Rectangle) => void,
    delta: number,
  ) {
    this.traceBullets(this.playerBullets, targets, onHit, delta);
  }

  traceEnemyBullets(
    target: Phaser.GameObjects.GameObject,
    onHit: (target: Phaser.GameObjects.GameObject, bullet: Phaser.GameObjects.Rectangle) => void,
    delta: number,
  ) {
    const targetBounds = (target as Phaser.GameObjects.GameObject & {
      getBounds: () => Phaser.Geom.Rectangle;
    }).getBounds();
    this.traceBullets(
      this.enemyBullets,
      undefined,
      (_unusedTarget, bullet) => onHit(target, bullet),
      delta,
      targetBounds,
    );
  }

  private traceBullets(
    bullets: Phaser.Physics.Arcade.Group,
    targets: Phaser.Physics.Arcade.Group | undefined,
    onHit: (target: Phaser.GameObjects.GameObject, bullet: Phaser.GameObjects.Rectangle) => void,
    delta: number,
    singleTargetBounds?: Phaser.Geom.Rectangle,
  ) {
    const distanceScale = delta / 1000;
    for (const bullet of bullets.getChildren() as Phaser.GameObjects.Rectangle[]) {
      if (!bullet.active) {
        continue;
      }

      const body = bullet.body as Phaser.Physics.Arcade.Body;
      const startX = bullet.x;
      const startY = bullet.y;
      const endX = startX + body.velocity.x * distanceScale;
      const endY = startY + body.velocity.y * distanceScale;
      const line = new Phaser.Geom.Line(startX, startY, endX, endY);

      if (singleTargetBounds) {
        if (this.lineIntersectsTarget(line, singleTargetBounds, bullet)) {
          onHit(bullet, bullet);
        }
        continue;
      }

      for (const target of targets!.getChildren()) {
        const targetWithBounds = target as Phaser.GameObjects.GameObject & {
          getBounds: () => Phaser.Geom.Rectangle;
        };
        if (!target.active || !this.lineIntersectsTarget(line, targetWithBounds.getBounds(), bullet)) {
          continue;
        }
        onHit(target, bullet);
        break;
      }
    }
  }

  private lineIntersectsTarget(
    line: Phaser.Geom.Line,
    bounds: Phaser.Geom.Rectangle,
    bullet: Phaser.GameObjects.Rectangle,
  ): boolean {
    const padding = Math.max(bullet.displayWidth, bullet.displayHeight) / 2;
    const expanded = new Phaser.Geom.Rectangle(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2,
    );
    return Phaser.Geom.Intersects.LineToRectangle(line, expanded);
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