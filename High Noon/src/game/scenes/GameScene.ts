import * as Phaser from 'phaser';
import { Level } from '../world/Level';
import { Player } from '../entities/Player';
import { Projectiles } from '../systems/Projectiles';
import { Revolver } from '../systems/Revolver';
import { EnemyManager, SpawnPoint } from '../systems/EnemyManager';
import { Pickups } from '../systems/Pickups';
import { Hud } from '../ui/Hud';
import { AimReticle } from '../ui/AimReticle';

const PLAYER_SPAWN = { x: 100, y: 100 };

const ENEMY_WAVE: SpawnPoint[] = [
  { x: 800, y: 100 },
  { x: 800, y: 200, size: 20 },
  { x: 800, y: 300 },
  { x: 800, y: 400 },
  { x: 800, y: 500 },
  { x: 800, y: 600 },
];


export class GameScene extends Phaser.Scene {
  private score = 0;
  private kills = 0;

  private level!: Level;
  private projectiles!: Projectiles;
  private player!: Player;
  private revolver!: Revolver;
  private reticle!: AimReticle;
  private enemies!: EnemyManager;
  private pickups!: Pickups;
  private hud!: Hud;

  private fireKey!: Phaser.Input.Keyboard.Key;
  private reloadKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('GameScene');
  }

  create() {
    this.level = new Level(this, 'testlevel');
    this.projectiles = new Projectiles(this, this.level.walls);

    this.player = new Player(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y, this.level.walls);
    this.hud = new Hud(this);
    this.revolver = new Revolver(this, this.player, this.projectiles, ({ ammo, maxAmmo, reloading }) => {
      this.hud.setAmmo(ammo, maxAmmo, reloading);
    });
    this.reticle = new AimReticle(this, this.player, this.revolver);

    this.enemies = new EnemyManager(this, this.level, this.player, this.projectiles);
    this.enemies.spawnWave(ENEMY_WAVE);

    this.pickups = new Pickups(this, this.level, this.player, (value) => {
      this.score += value;
      this.hud.setCash(this.score);
    });
    this.pickups.spawn();

    this.hud.setCash(this.score);
    this.hud.setKills(this.kills);

    this.setupCamera();
    this.setupInput();
    this.setupRules();
    this.playMusic();
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
      this.fireAtPointer();
    }
    if (Phaser.Input.Keyboard.JustDown(this.reloadKey)) {
      this.revolver.startReload();
    }

    this.player.update(this.revolver.isReloading);
    this.enemies.update(this.kills);
    this.reticle.update();
    this.revolver.update();
  }

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.level.width, this.level.height);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
  }

  private setupInput() {
    const keyboard = this.input.keyboard!;
    this.fireKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.reloadKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.input.on('pointerdown', () => this.fireAtPointer());
  }

  private setupRules() {
    this.player.on(Player.Events.Dodge, () => {
      this.revolver.cancelReload();
      this.revolver.addRound();
    });

    this.enemies.on(EnemyManager.Events.Killed, () => {
      this.kills += 1;
      this.hud.setKills(this.kills);
    });

    this.enemies.on(EnemyManager.Events.WaveCleared, () => this.scene.restart());

    this.physics.add.overlap(this.player, this.enemies.group, () => this.onPlayerHit());
    this.physics.add.overlap(this.player, this.projectiles.enemyBullets, (_player, bullet) => {
      (bullet as Phaser.GameObjects.Rectangle).destroy();
      this.onPlayerHit();
    });
  }

  private fireAtPointer() {
    const pointer = this.input.activePointer;
    this.revolver.fire(pointer.worldX, pointer.worldY, this.reticle.radius);
  }

  private onPlayerHit() {
    if (this.player.isInvulnerable) {
      return;
    }
    this.score = 0;
    this.kills = 0;
    this.scene.start('GameOver');
  }

  private playMusic() {
    if (!this.sound.get('bgmusichill')?.isPlaying) {
      this.sound.add('bgmusichill', { loop: true, volume: 0.05 }).play();
    }
  }
}