import * as Phaser from 'phaser';
import { Level } from '../../world/Level.ts';
import { Player } from '../../entities/Player.ts';
import { Projectiles } from '../../systems/Projectiles.ts';
import { Weapon } from '../../systems/Weapon.ts';
import { EnemyManager } from '../../systems/EnemyManager.ts';
import { Pickups } from '../../systems/Pickups.ts';
import { Hud } from '../../ui/Hud.ts';
import { AimReticle } from '../../ui/AimReticle.ts';
import { Pathfinder } from '../../systems/Pathfinder.ts';
import { BALANCE } from '../../config/balance.ts';

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
  private pathfinder!: Pathfinder;
  private dynamites!: Phaser.Physics.Arcade.Group;

  private fireKey!: Phaser.Input.Keyboard.Key;
  private reloadKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('GameScene');
  }

  create() {
    this.health = 4;
    this.level = new Level(this, 'testlevel');
    this.pathfinder = new Pathfinder(this.level.walls);
    this.projectiles = new Projectiles(this, this.level.walls);

    const playerSpawn = this.level.getSpawns('player')[0] ?? PLAYER_SPAWN;
    this.player = new Player(this, playerSpawn.x, playerSpawn.y, this.level.walls);

    this.hud = new Hud(this, this.player, this.level);
    this.weapon = new Weapon(this, this.player, this.projectiles, ({ ammo, maxAmmo, reloading }) => {
      this.hud.setAmmo(ammo, maxAmmo, reloading);
    });
    this.reticle = new AimReticle(this, this.player, this.weapon);
    this.hud.minimap.ignore(this.reticle.circle);

    this.enemies = new EnemyManager(this, this.level, this.player, this.projectiles, this.pathfinder);    
    this.enemies.spawnWave(this.level.getSpawns("enemy"));
    this.dynamites = this.physics.add.group();
    
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
    this.pathfinder.update();
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
    keyboard.on('keydown-FOUR', () =>{
      if (this.kills >= BALANCE.dynamiteUnlockKills) {
      this.weapon.equipedGun = 'dynamite';
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
    this.physics.add.overlap(this.enemies.group, this.dynamites, (_enemy, object) => {
      const dynamite = object as Phaser.GameObjects.Arc;
      if (!dynamite.active) {
        return;
      }
      const x = dynamite.x;
      const y = dynamite.y;
      dynamite.destroy();
      this.explodeDynamite(x, y);
      this.enemies.explodeAt(x, y, BALANCE.dynamite.blastRadius);
    });
  }

  private fireAtPointer() {
    const pointer = this.input.activePointer;
    if (this.weapon.equipedGun === 'dynamite') {
      this.placeDynamite();
      return;
    }
    this.weapon.fire(pointer.worldX, pointer.worldY, this.reticle.radius);
  }

  private placeDynamite() {
    if (!this.weapon.consumeDynamite()) {
      return;
    }
    const dynamite = this.add.circle(this.player.x, this.player.y, 12, 0xd35400);
    dynamite.setStrokeStyle(3, 0xffd000);
    this.physics.add.existing(dynamite);
    const body = dynamite.body as Phaser.Physics.Arcade.Body;
    const radius = BALANCE.dynamite.activationRadius;
    body.setCircle(radius, 12 - radius, 12 - radius);
    this.dynamites.add(dynamite);
    this.sound.play('sixshooterinsert', { volume: 0.2 });
  }

  private explodeDynamite(x: number, y: number) {
    const explosion = this.add.circle(x, y, 12, 0xff6b00, 0.8).setDepth(20);
    this.tweens.add({
      targets: explosion,
      radius: BALANCE.dynamite.blastRadius,
      alpha: 0,
      duration: 350,
      onComplete: () => explosion.destroy(),
    });
    this.sound.play('ricochet-1', { volume: 0.4 });
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