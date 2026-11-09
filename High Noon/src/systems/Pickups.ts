import * as Phaser from 'phaser';
import { Level } from '../world/Level.ts';


export class Pickups {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(
    private scene: Phaser.Scene,
    private level: Level,
    player: Phaser.GameObjects.GameObject,
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

  spawn(
  count: number,
  symbol: string,
  backgroundColor: string,
  onCollect: () => void,
   padding: Phaser.Types.GameObjects.Text.TextPadding = { left: 12, right: 12 },
   sound = 'moneypickup',
  ) {
    for (let i = 0; i < count; i += 1) {
      const { x, y } = this.level.findFreeSpot();
      const pickup = this.scene.add.text(x, y, symbol, {
        color: 'white',
        backgroundColor,
        fontSize: '22px',
        padding,
      });

      pickup.setData('onCollect', onCollect);
      pickup.setData('sound', sound);
      this.group.add(pickup);
    }
  }

  private collect(pickup: Phaser.GameObjects.Text) {
    pickup.getData('onCollect')();
    this.scene.sound.play(pickup.getData('sound'), {
     volume: 0.4,
     detune: Phaser.Math.Between(-100, 100),
    });
    pickup.destroy();
  }
}