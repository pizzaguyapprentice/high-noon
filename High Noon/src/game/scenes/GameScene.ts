import * as Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private walls!: Phaser.GameObjects.Rectangle[];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private shotTimes: number[] = [];
  private speed = 160;

  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#c2a36b');

    this.walls = [
      this.add.rectangle(300, 200, 200, 32, 0x6b4f2a),
      this.add.rectangle(550, 400, 32, 200, 0x6b4f2a),
    ];
    this.walls.forEach(w => this.physics.add.existing(w, true));

    this.player = this.add.rectangle(100, 100, 16, 16, 0xffcc00);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.walls);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as any;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.shootAt(pointer.worldX, pointer.worldY);
    });
  }

  private shootAt(targetX: number, targetY: number) {
    //math stuff for bullet direction and spread
    const bullet = this.add.rectangle(this.player.x, this.player.y, 5, 5, 0x0);
    const directionX = targetX - this.player.x;
    const directionY = targetY - this.player.y;
    const distance = Math.sqrt(directionX ** 2 + directionY ** 2);
    const now = this.time.now;
    //timer for accuracy
    this.shotTimes = this.shotTimes.filter(shotTime => now - shotTime < 3000);
    const isAccurate = this.shotTimes.length < 2;
    this.shotTimes.push(now);
    const spread = isAccurate ? 0 : Phaser.Math.FloatBetween(-distance * 0.1, distance * 0.1);
    const spreadTargetX = distance > 0 ? targetX - (directionY / distance) * spread : targetX;
    const spreadTargetY = distance > 0 ? targetY + (directionX / distance) * spread : targetY;

    this.physics.add.existing(bullet);
    this.physics.moveTo(bullet, spreadTargetX, spreadTargetY, 600);

    this.physics.add.collider(bullet, this.walls, () => {
      bullet.destroy();
    });
  }

  update() {
    //all input logic here
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      const pointer = this.input.activePointer;
      this.shootAt(pointer.worldX, pointer.worldY);
    }

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