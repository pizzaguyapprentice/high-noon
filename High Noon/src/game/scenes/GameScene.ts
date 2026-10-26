import * as Phaser from 'phaser';
import { BALANCE } from '../../config/balance.ts';
import { Level } from '../../world/Level.ts';
import { Player } from '../../entities/Player.ts';
import { Projectiles } from '../../systems/Projectiles.ts';
import { Weapon } from '../../systems/Weapon.ts';
import { EnemyManager, SpawnPoint } from '../../systems/EnemyManager.ts';
import { Pickups } from '../../systems/Pickups.ts';
import { Hud } from '../../ui/Hud.ts';
import { AimReticle } from '../../ui/AimReticle.ts';

const PLAYER_SPAWN = { x: 100, y: 100 };

// const ENEMY_WAVE: SpawnPoint[] = [
//   { x: 800, y: 100 },
//   { x: 800, y: 200, size: 20 },
//   { x: 800, y: 300 },
//   { x: 800, y: 400 },
//   { x: 800, y: 500 },
//   { x: 800, y: 600 },
// ];


export class GameScene extends Phaser.Scene {
  private score = 0;
  private kills = 0;
  private health = 4;

  private level!: Level;
  private projectiles!: Projectiles;
  private player!: Player;
  private weapon!: Weapon;
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
    this.health = 4;
    this.level = new Level(this, 'testlevel');
    this.projectiles = new Projectiles(this, this.level.walls);

    const playerSpawn = this.level.getSpawns('player')[0] ?? PLAYER_SPAWN;
    this.player = new Player(this, playerSpawn.x, playerSpawn.y, this.level.walls);

    this.hud = new Hud(this, this.player, this.level);
    this.weapon = new Weapon(this, this.player, this.projectiles, ({ ammo, maxAmmo, reloading }) => {
      this.hud.setAmmo(ammo, maxAmmo, reloading);
    });
    this.reticle = new AimReticle(this, this.player, this.weapon);
    this.hud.minimap.ignore(this.reticle.circle);

    this.enemies = new EnemyManager(this, this.level, this.player, this.projectiles);    
    this.enemies.spawnWave(this.level.getSpawns("enemy"));
    
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
      this.weapon.startReload();
    }

    this.player.update(this.weapon.isReloading);
    this.enemies.update(this.kills);
    this.reticle.update();
    this.weapon.update();
    this.hud.playerDot.setPosition(this.player.x, this.player.y);
    this.hud.setEquipedGun(this.weapon.equipedGun, this.kills);
  }

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.level.width, this.level.height);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
  }

  private setupInput() {
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-ONE', () =>{
      this.weapon.equipedGun = 'revolver';
    });
    keyboard.on('keydown-TWO', () =>{
      if (this.kills >= BALANCE.rifleUnlockKills) {
      this.weapon.equipedGun = 'rifle';
      }
     });
    keyboard.on('keydown-THREE', () =>{
      if (this.kills >= BALANCE.shotgunUnlockKills) {
      this.weapon.equipedGun = 'shotgun';
      }
    });
    this.fireKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.reloadKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.input.on('pointerdown', () => this.fireAtPointer());
  }

  private setupRules() {
    this.player.on(Player.Events.Dodge, () => {
      this.weapon.cancelReload();
      this.weapon.addRound();
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
    this.weapon.fire(pointer.worldX, pointer.worldY, this.reticle.radius);
  }

  private onPlayerHit() {
    if (this.player.isInvulnerable) {
      return;
    }

    this.health -= 1;
    this.player.protectAfterHit();
    this.hud.setHealth(this.health);

    if (this.health <= 0){
    this.score = 0;
    this.kills = 0;
    this.scene.start('GameOver');
    }
  }

  private playMusic() {
    if (!this.sound.get('bgmusichill')?.isPlaying) {
      this.sound.add('bgmusichill', { loop: true, volume: 0.05 }).play();
    }
  }
}