import * as Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private speed = 160;

  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#c2a36b');

    const walls = [
      this.add.rectangle(300, 200, 200, 32, 0x6b4f2a),
      this.add.rectangle(550, 400, 32, 200, 0x6b4f2a),
    ];
    walls.forEach(w => this.physics.add.existing(w, true));

    this.player = this.add.rectangle(100, 100, 16, 16, 0xffcc00);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, walls);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as any;
  }

  update() {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    const dir = new Phaser.Math.Vector2(
      Number(right) - Number(left),
      Number(down) - Number(up)
    ).normalize();

    this.playerBody.setVelocity(dir.x * this.speed, dir.y * this.speed);
  }
}