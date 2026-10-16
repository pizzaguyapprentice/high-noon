import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';
import { Enemy } from '../entities/Enemy.ts';
import { Level } from '../world/Level.ts';
import { Projectiles } from './Projectiles.ts';

export interface SpawnPoint {
  x: number;
  y: number;
  size?: number;
}

type Target = { x: number; y: number };

export class EnemyManager extends Phaser.Events.EventEmitter {
  static readonly Events = {
    Killed: 'enemy-killed',
    WaveCleared: 'wave-cleared',
  } as const;

  readonly group: Phaser.Physics.Arcade.Group;

  constructor(
    private scene: Phaser.Scene,
    private level: Level,
    private target: Target,
    private projectiles: Projectiles,
  ){
    super();

    this.group = scene.physics.add.group({ collideWorldBounds: true });
    scene.physics.add.collider(this.group, level.walls);
    scene.physics.add.collider(this.group, this.group);

    scene.physics.add.overlap(this.group, projectiles.playerBullets, (enemy, bullet) => {
      this.onShot(enemy as Enemy, bullet as Phaser.GameObjects.Rectangle);
    });

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeAllListeners());
  }

  spawnWave(points: SpawnPoint[]) {
    for (const { x, y, size } of points) {
      this.group.add(new Enemy(this.scene, x, y, size));
    }
  }

  update(kills: number) {
    const now = this.scene.time.now;
    for (const enemy of this.group.getChildren() as Enemy[]) {
      const distance = Phaser.Math.Distance.Between(enemy.x,enemy.y,this.target.x,this.target.y);
      const canSeeTarget = distance <= BALANCE.enemy.loseRange && this.level.hasLineOfSight(enemy,this.target);
      enemy.think({now,target:this.target,kills,distance,canSeeTarget});

      if(enemy.aiState === "advancing"){
        this.tryShoot(enemy,now,kills);
      }
      enemy.enemyDot.setPosition(enemy.x, enemy.y);
      enemy.updateReloadBar(now);
    }
  }

  private tryShoot(enemy: Enemy, now: number, kills: number) {
    if (!enemy.isReadyToFire(now)) {
      return;
    }
    this.scene.sound.play('sixshootershot', { volume: 0.2, detune: Phaser.Math.Between(-100, 100) });
    enemy.registerShot(now, kills);

    const direction = new Phaser.Math.Vector2(this.target.x - enemy.x, this.target.y - enemy.y)
      .rotate(Phaser.Math.FloatBetween(-BALANCE.enemy.spread, BALANCE.enemy.spread))
      .normalize();
    this.projectiles.fireEnemyBullet(enemy.x, enemy.y, direction);
  }

  private onShot(enemy: Enemy, bullet: Phaser.GameObjects.Rectangle) {
    if (!bullet.active || !enemy.active) {
      return;
    }
    bullet.destroy();
    enemy.destroy(); 

    this.scene.sound.play('hitmark', {
      volume: Phaser.Math.FloatBetween(0.5, 0.7),
      detune: Phaser.Math.Between(-500, 500),
    });
    this.scene.sound.play('scream', {
      volume: Phaser.Math.FloatBetween(0.1, 0.2),
      detune: Phaser.Math.Between(-150, 800),
    });

    this.emit(EnemyManager.Events.Killed);
    if (this.group.countActive() === 0) {
      this.emit(EnemyManager.Events.WaveCleared);
    }
  }
}