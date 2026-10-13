import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';

type MoveKeys = Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

export class Player extends Phaser.GameObjects.Rectangle {
  static readonly Events = {
    Dodge: 'player-dodge',
  } as const;

  declare body: Phaser.Physics.Arcade.Body;

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: MoveKeys;
  private dodgeKey: Phaser.Input.Keyboard.Key;

  private lastDodgeAt = -Infinity;
  private dodgeDirection = new Phaser.Math.Vector2();
  private invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, walls: Phaser.Tilemaps.TilemapLayer) {
    super(scene, x, y, 16, 16, 0x0f4d0f);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setCollideWorldBounds(true);
    scene.physics.add.collider(this, walls);

    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys('W,A,S,D') as MoveKeys;
    this.dodgeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil;
  }

  get isDodging(): boolean {
    return this.scene.time.now < this.lastDodgeAt + BALANCE.player.dodgeDuration;
  }


  update(slowed: boolean) {
    const input = this.readMoveInput();

    if (Phaser.Input.Keyboard.JustDown(this.dodgeKey)) {
      this.tryDodge(input);
    }

    const speed = slowed ? BALANCE.player.reloadSpeed : BALANCE.player.speed;

    if (this.isDodging) {
      const dodgeSpeed = speed * BALANCE.player.dodgeMultiplier;
      this.body.setVelocity(this.dodgeDirection.x * dodgeSpeed, this.dodgeDirection.y * dodgeSpeed);
    } else {
      this.body.setVelocity(input.x * speed, input.y * speed);
    }
  }

  private readMoveInput(): Phaser.Math.Vector2 {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    return new Phaser.Math.Vector2(
      Number(right) - Number(left),
      Number(down) - Number(up),
    ).normalize();
  }

  private tryDodge(direction: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (now < this.lastDodgeAt + BALANCE.player.dodgeCooldown) {
      return;
    }

    this.dodgeDirection.copy(direction);
    if (this.dodgeDirection.lengthSq() === 0) {
      const pointer = this.scene.input.activePointer;
      this.dodgeDirection.set(pointer.worldX - this.x, pointer.worldY - this.y).normalize();
    }
    if (this.dodgeDirection.lengthSq() === 0) {
      this.dodgeDirection.set(1, 0);
    }

    this.lastDodgeAt = now;
    this.invulnerableUntil = now + BALANCE.player.dodgeDuration;
    this.emit(Player.Events.Dodge);
  }
}