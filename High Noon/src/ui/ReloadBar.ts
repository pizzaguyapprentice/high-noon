import * as Phaser from 'phaser';

const WIDTH = 36;
const HEIGHT = 5;
const BAR_OFFSET_Y = 22;   
const LABEL_OFFSET_Y = 31; 


export class ReloadBar {
  private bar: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private color: number) {
    this.bar = scene.add.graphics().setDepth(20);
    this.label = scene.add.text(0, 0, '', {
      fontSize: '11px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21).setVisible(false);
  }


  show(x: number, y: number, progress: number, remainingMs: number) {
    const p = Phaser.Math.Clamp(progress, 0, 1);
    const left = x - WIDTH / 2;
    const top = y - BAR_OFFSET_Y;

    this.bar.clear();
    this.bar.fillStyle(0x222222, 0.85);
    this.bar.fillRect(left, top, WIDTH, HEIGHT);
    this.bar.fillStyle(this.color, 1);
    this.bar.fillRect(left, top, WIDTH * p, HEIGHT);

    this.label
      .setVisible(true)
      .setPosition(x, y - LABEL_OFFSET_Y)
      .setText(`${(Math.max(remainingMs, 0) / 1000).toFixed(1)}s`);
  }

  hide() {
    this.bar.clear();
    this.label.setVisible(false);
  }

  destroy() {
    this.bar.destroy();
    this.label.destroy();
  }
}