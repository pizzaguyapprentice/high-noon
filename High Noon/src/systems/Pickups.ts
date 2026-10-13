import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';
import { Level } from '../world/Level.ts';

const MAX_DRIFT_SPEED = 100;

export class Pickups {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(
    private scene: Phaser.Scene,
    private level: Level,
    player: Phaser.GameObjects.GameObject,
    private onCollect: (value: number) => void,
  ) {
    this.group = scene.physics.add.group({
      collideWorldBounds: true,
      bounceX: 1,
      bounceY: 1,
    });
    scene.physics.add.collider(this.group, level.walls);

    scene.physics.add.overlap(player, this.group, (_player, pickup) => {
      this.collect(pickup as Phaser.GameObjects.Text);
    });
  }

  spawn(count: number = BALANCE.economy.pickupCount) {
    for (let i = 0; i < count; i += 1) {
      const { x, y } = this.level.findFreeSpot();
      const pickup = this.scene.add.text(x, y, '$', {
        color: 'white',
        backgroundColor: 'green',
        fontSize: '22px',
        padding: { left: 12, right: 12 },
      });

      this.group.add(pickup);
      (pickup.body as Phaser.Physics.Arcade.Body).setVelocity(
        Phaser.Math.Between(-MAX_DRIFT_SPEED, MAX_DRIFT_SPEED),
        Phaser.Math.Between(-MAX_DRIFT_SPEED, MAX_DRIFT_SPEED),
      );
    }
  }

  private collect(pickup: Phaser.GameObjects.Text) {
    if (!pickup.active) {
      return;
    }
    pickup.destroy();
    this.scene.sound.play('moneypickup', { volume: 0.2, detune: Phaser.Math.Between(-100, 100) });
    this.onCollect(BALANCE.economy.pickupValue);
  }
}