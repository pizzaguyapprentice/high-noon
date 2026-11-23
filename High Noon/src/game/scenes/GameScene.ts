import * as Phaser from "phaser";
import { Level } from "../../world/Level.ts";
import { Player } from "../../entities/Player.ts";
import { Projectiles } from "../../systems/Projectiles.ts";
import { Weapon } from "../../systems/Weapon.ts";
import { EnemyManager } from "../../systems/EnemyManager.ts";
import { Pickups } from "../../systems/Pickups.ts";
import { Hud } from "../../ui/Hud.ts";
import { AimReticle } from "../../ui/AimReticle.ts";
import { Pathfinder } from "../../systems/Pathfinder.ts";
import { BALANCE } from "../../config/balance.ts";
import { Horse } from '../../entities/Horse.ts';
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
  private horse!: Horse;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private horsePrompt!: Phaser.GameObjects.Text;
  private riding = false;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private reloadKey!: Phaser.Input.Keyboard.Key;
  private defaultZoom = 1;

  constructor() {
    super("GameScene");
  }

  create() {
    this.level = new Level(this, "testlevel");
    this.pathfinder = new Pathfinder(this.level.walls);
    this.projectiles = new Projectiles(this, this.level.walls);

    const playerSpawn = this.level.getSpawns("player")[0] ?? PLAYER_SPAWN;
    this.player = new Player(this, playerSpawn.x, playerSpawn.y, this.level.walls);

    //not mounted upon death
    this.riding = false;
    //honse spawns 60 pixels to the right of the player
    this.horse = new Horse(this, playerSpawn.x + 60, playerSpawn.y);
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, this.syncHorse, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.PRE_RENDER, this.syncHorse, this));
    //this.physics.add.collider(this.horse, this.level.walls, () => this.horse.onBump());
    this.interactKey = this.input.keyboard!.addKey('E');
    this.horsePrompt = this.add.text(0, 0,'', { fontSize:'12px',color: '#000'}).setOrigin(0.5).setDepth(22).setVisible(false);
    
    
    this.hud = new Hud(this, this.player, this.level);
    this.weapon = new Weapon(this, this.player, this.projectiles, ({ ammo, maxAmmo, reloading }) => {
      this.hud.setAmmo(ammo, maxAmmo, reloading);
    });
    this.reticle = new AimReticle(this, this.player, this.weapon);

    this.hud.minimap.ignore(this.reticle.cone);
    this.enemies = new EnemyManager(this, this.level, this.player, this.projectiles, this.pathfinder);
    this.enemies.spawnWave(this.level.getSpawns("enemy"));
    this.dynamites = this.physics.add.group();

    this.pickups = new Pickups(this, this.level, this.player);

    this.pickups.spawn(
      BALANCE.cash.placedOnMap,
      BALANCE.cash.emoji,
      BALANCE.cash.bgColor,
      BALANCE.cash.sound,
      BALANCE.cash.size,
      BALANCE.cash.padding,
      () => {
        this.score += BALANCE.cash.value;
        this.hud.setCash(this.score);
      },
    );

    this.pickups.spawn(
      BALANCE.goldBag.placedOnMap,
      BALANCE.goldBag.emoji,
      BALANCE.goldBag.bgColor,
      BALANCE.goldBag.sound,
      BALANCE.goldBag.size,
      BALANCE.goldBag.padding,
      () => {
        this.score += BALANCE.goldBag.value;
        this.hud.setCash(this.score);
      },
    );

    this.pickups.spawn(
      BALANCE.beerHeal.placedOnMap,
      BALANCE.beerHeal.emoji,
      BALANCE.beerHeal.bgColor,
      BALANCE.beerHeal.sound,
      BALANCE.beerHeal.size,
      BALANCE.beerHeal.padding,
      () => {
        this.player.beerHeal(BALANCE.beerHeal.healAmount);
        this.hud.setHealth(this.player.currentHealth);
      },
    );

    this.pickups.spawn(
      BALANCE.cowboyHat.placedOnMap,
      BALANCE.cowboyHat.emoji,
      BALANCE.cowboyHat.bgColor,
      BALANCE.cowboyHat.sound,
      BALANCE.cowboyHat.size,
      BALANCE.cowboyHat.padding,
      () => {
        this.player.cowbowSpeedBoost();
      },
    );

    this.hud.setCash(this.score);
    this.hud.setKills(this.kills);
    this.setupCamera();
    this.setupInput();
    this.setupRules();
    this.playMusic();
  }

  update(_time:number, delta:number) {
    if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
      this.fireAtPointer();
    }
    if (Phaser.Input.Keyboard.JustDown(this.reloadKey)) {
      this.weapon.startReload();
    }
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.toggleHorse();
    }

    if (this.riding) {
      this.horse.ride(delta, this.player.body as Phaser.Physics.Arcade.Body);
    } else {
      this.horse.idle();
    }
    this.player.update(this.weapon.isReloading, this.riding);
    this.updateHorsePrompt();


    if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
      this.fireAtPointer();
    }
    if (Phaser.Input.Keyboard.JustDown(this.reloadKey)) {
      this.weapon.startReload();
    }

    //this.player.update(this.weapon.isReloading);
    this.enemies.update(this.kills);
    this.enemies.tracePlayerBullets(this.game.loop.delta);
    this.projectiles.traceEnemyBullets(
      this.player,
      (_player, bullet) => {
        const enemyBullet = bullet as Phaser.GameObjects.Rectangle;
        const damage = enemyBullet.getData("damage") ?? BALANCE.enemy.bulletDamage;
        enemyBullet.destroy();
        this.onPlayerHit(damage);
      },
      this.game.loop.delta,
    );
    this.reticle.update();
    this.weapon.update();
    this.pathfinder.update();
    this.hud.playerDot.setPosition(this.player.x, this.player.y);
    this.hud.setEquipedGun(this.weapon.equipedGun, this.kills);

    [
      ...this.projectiles.playerBullets.getChildren(),
      ...this.projectiles.enemyBullets.getChildren(),
    ].forEach((bullet) => {
      const { x, y } = bullet as Phaser.GameObjects.Rectangle;
      const smokeTrail = this.add.circle(x, y, 3, 0x808080, 0.5);

      this.tweens.add({
        targets: smokeTrail,
        alpha: 0,
        duration: 250,
        onComplete: () => smokeTrail.destroy(),
      });
    });


  }

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.level.width, this.level.height);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.defaultZoom = this.cameras.main.zoom;
  }

  private setupInput() {
    const keyboard = this.input.keyboard!;
    keyboard.on("keydown-ESC", this.openPauseMenu, this);
    this.events.once("shutdown", () => {
      keyboard.off("keydown-ESC", this.openPauseMenu, this);
    });
    keyboard.on("keydown-ONE", () => {
      this.hud.showHotbar();
      this.weapon.equipedGun = "revolver";
    });
    keyboard.on("keydown-TWO", () => {
      this.hud.showHotbar();
      if (this.kills >= BALANCE.rifleUnlockKills) {
        this.weapon.equipedGun = "rifle";
      }
    });
    keyboard.on("keydown-THREE", () => {
      this.hud.showHotbar();
      if (this.kills >= BALANCE.shotgunUnlockKills) {
        this.weapon.equipedGun = "shotgun";
      }
    });
    keyboard.on("keydown-FOUR", () => {
      this.hud.showHotbar();
      if (this.kills >= BALANCE.dynamiteUnlockKills) {
        this.weapon.equipedGun = "dynamite";
      }
    });
    this.input.on("wheel", (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      const availableGuns = ["revolver"];
      if (this.kills >= BALANCE.rifleUnlockKills) {
        availableGuns.push("rifle");
      }
      if (this.kills >= BALANCE.shotgunUnlockKills) {
        availableGuns.push("shotgun");
      }
      if (this.kills >= BALANCE.dynamiteUnlockKills) {
        availableGuns.push("dynamite");
      }

      const currentIndex = availableGuns.indexOf(this.weapon.equipedGun);
      const direction = deltaY > 0 ? 1 : -1;
      const nextIndex = (currentIndex + direction + availableGuns.length) % availableGuns.length;
      this.weapon.equipedGun = availableGuns[nextIndex];
      this.hud.showHotbar();
    });
    this.fireKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.reloadKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.input.on("pointerdown", () => this.fireAtPointer());
  }

  private openPauseMenu() {
    if (this.scene.isActive("MainMenu")) {
      return;
    }
    this.scene.launch("MainMenu", { pauseGame: true });
    this.scene.bringToTop("MainMenu");
    this.scene.pause();
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
      const enemyBullet = bullet as Phaser.GameObjects.Rectangle;
      const damage = enemyBullet.getData("damage") ?? BALANCE.enemy.bulletDamage;
      enemyBullet.destroy();
      this.onPlayerHit(damage);
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
    //const pointer = this.input.activePointer;
    if (this.weapon.equipedGun === "dynamite") {
      this.placeDynamite();
      return;
    }
    this.weapon.fire(this.reticle.aim.x, this.reticle.aim.y, this.reticle.radius);
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
    this.sound.play("sixshooterinsert", { volume: 0.2 });
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
    this.sound.play("ricochet-1", { volume: 0.4 });
  }

  private onPlayerHit(damage = 1) {
    if (!this.player.takeDamage(damage)) {
      return;
    }

    this.sound.play(`playerhit${Phaser.Math.Between(0, 2)}`, {
      volume: Phaser.Math.FloatBetween(0.3, 0.35),
      detune: Phaser.Math.Between(-600, -350),
    });

    this.hud.setHealth(this.player.currentHealth);

    if (this.player.currentHealth <= 0) {
      this.score = 0;
      this.kills = 0;
      this.scene.start("GameOver");
    }
  }
  //
  private toggleHorse() {
  if (this.riding) {
    this.dismount();
    return;
  }

  const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.horse.x, this.horse.y);
  if (distance > BALANCE.horse.mountRange) {
    return;
  }

  if (!this.horse.owned) {
    if (this.score < BALANCE.horse.price) {
      return; // can't afford it; the prompt already says so
    }
    this.score -= BALANCE.horse.price; // remove this line to make $150 a requirement instead of a cost
    this.hud.setCash(this.score);
    this.horse.owned = true;
  }

  this.mount();
}

private mount() {
  const body = this.player.body as Phaser.Physics.Arcade.Body;
  body.reset(this.horse.x, this.horse.y); 
  this.player.setDepth(this.horse.depth+1);

  this.riding = true;
  this.horse.mount();
  this.sound.play('horseneigh', { volume: 0.4 });
  this.pickups.collectEnabled = false;
  this.cameras.main.zoomTo(this.defaultZoom*0.90,600, 'Sine.easeInOut');
}

private dismount() {
  this.riding = false;
  this.horse.dismount();

  //step off to the horse's right side or its left if there's a wall
  const side = new Phaser.Math.Vector2(0, 24).rotate(this.horse.rotation);
  let x = this.horse.x + side.x;
  let y = this.horse.y + side.y;
  if (this.level.walls.getTileAtWorldXY(x, y)?.collides) {
    x = this.horse.x - side.x;
    y = this.horse.y - side.y;
  }

  const body = this.player.body as Phaser.Physics.Arcade.Body;
  body.reset(x, y); 
  this.pickups.collectEnabled = true;
  this.cameras.main.zoomTo(this.defaultZoom, 600, 'Sine.easeInOut');
}

private updateHorsePrompt() {
  const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.horse.x, this.horse.y);
  const showPrompt = !this.riding && distance <= BALANCE.horse.mountRange;

  this.horsePrompt.setVisible(showPrompt);
  if (!showPrompt) {
    return;
  }

  this.horsePrompt.setPosition(this.horse.x, this.horse.y - 24);
  if (this.horse.owned) {
    this.horsePrompt.setText('E: Ride');
  } else if (this.score >= BALANCE.horse.price) {
    this.horsePrompt.setText(`E: Buy horse ($${BALANCE.horse.price})`);
  } else {
    this.horsePrompt.setText(`Horse: $${BALANCE.horse.price}`);
  }
}

    private syncHorse() {
      if (this.riding) {
        this.horse.setPosition(this.player.x, this.player.y);
      }
    }
  private playMusic() {
    if (!this.sound.get("bgmusichill")?.isPlaying) {
      this.sound.add("bgmusichill", { loop: true, volume: 0.05 }).play();
    }
  }
}
