import * as Phaser from 'phaser';

export class GameScene extends Phaser.Scene {


  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  //private walls!: Phaser.GameObjects.Rectangle[];
  private enemies!: Phaser.GameObjects.Rectangle[];
  private enemyNextShotTimes = new Map<Phaser.GameObjects.Rectangle, number>();
  private enemyShotsFired = new Map<Phaser.GameObjects.Rectangle, number>();
  private enemySpeed = 60;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private shotTimes: number[] = [];
  private speed = 100;
  private pickups!: Phaser.Physics.Arcade.Group;
  private scoretext!: Phaser.GameObjects.Text;
  private score: number = 0;
  private killtext!: Phaser.GameObjects.Text;
  private kills: number = 0;


  //Shooting mechanics, cursor, bullet behaviour, bullet spread
  private aimCircle!: Phaser.GameObjects.Arc;
  private aimRadius = 0 ; //
  private minimumSpread = 24; // in pixels
  private spreadPerShot = 16; // in pixels
  private maxSpread = 120; //in pixels
  private bulletSpeed = 1500; // in pixels per second
  private enemyBulletSpeed = 500;
  private enemyFireInterval = 2000;
  private enemyReloadTime = 6000;
  private enemySpread = 0.7; // radians of aim error on either side of the player
  private cursorCooldown = 1200; // in milliseconds, how long to wait before the circle shrinks again for each shot
  private range = 200;
  private minCircleSize = 0.5
  private maxCircleSize = 2.5

  //Reloading variables
  private maxAmmo = 6;
  private reloadTime = 500; // in milliseconds per bullet
  private ammo = 6
  private isReloading = false;
  private reloadTimer?: Phaser.Time.TimerEvent;
  private reloadKey!: Phaser.Input.Keyboard.Key;
  private ammoText!: Phaser.GameObjects.Text; // displaying amount of ammo

  private wallLayer!: Phaser.Tilemaps.TilemapLayer;

  constructor() {
    super('GameScene');
  }

  create() {

    // Initializing map
    const map = this.make.tilemap({ key: 'testlevel' });
    const deserttiles = map.addTilesetImage('deserttile1', 'deserttiles', 32,32);
    const walltiles = map.addTilesetImage('walltile1', 'walltiles', 32,32);
    const allTiles = [deserttiles!, walltiles!];

    map.createLayer("Ground",allTiles);
    this.wallLayer = map.createLayer("Walls",allTiles)!;
    this.wallLayer.setCollisionByProperty({ collides: true });
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    //bullets move too fast, this fixes the collision issues
    this.physics.world.TILE_BIAS = 32;
    // Initializing player

    this.player = this.add.rectangle(100, 100, 16, 16, 0x0f4d0f);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.wallLayer);
   
    this.physics.add.collider(this.player, this.wallLayer);
    
    

    this.reloadKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    this.ammoText = this.add.text(16,52,'',{fontSize:'24px',color:'#000'}).setScrollFactor(0).setDepth(100);
    this.ammo = this.maxAmmo
    this.updateAmmoText();
    //Creating the cursor aimer
    this.aimCircle = this.add.circle(0, 0, this.aimRadius, 0xff0000, 0.25).setStrokeStyle(1, 0xff0000, 0.5).setDepth(10);
    this.input.setDefaultCursor('crosshair')


    // this.cameras.main.setBackgroundColor('#c2a36b');

    // this.walls = [
    //   this.add.rectangle(300, 200, 200, 32, 0x6b4f2a),
    //   this.add.rectangle(550, 400, 32, 200, 0x6b4f2a),
    // ];
    // this.walls.forEach(w => this.physics.add.existing(w, true));

   

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);


    //make the pickups
    this.pickups = this.physics.add.group();
    this.physics.add.collider(this.pickups, this.wallLayer)
    for (let index = 0; index < 6; index += 1) {
      //random pickup spawn positions
      let spawnX = 0;
      let spawnY = 0;
      let overlapsWall = true;
      //CHECK FOR WALLS
      while (overlapsWall) {
          spawnX = Phaser.Math.Between(24,map.widthInPixels-24);
          spawnY = Phaser.Math.Between(24,map.heightInPixels-24);
          const tile = this.wallLayer.getTileAtWorldXY(spawnX,spawnY);
          overlapsWall = !!tile && tile.collides;
        } 
      

      const pickup = this.add.text(
        spawnX,
        spawnY,
        '$',
          {
            color: 'white',
            backgroundColor: 'green',
            fontSize: "22px",
            padding: {left: 12, right: 12} 
          }
      );
      this.physics.add.existing(pickup);

      //pickup movement and bouncing
      const pickupBody = pickup.body as Phaser.Physics.Arcade.Body;
      pickupBody.setCollideWorldBounds(true);
      pickupBody.setBounce(1);
      pickupBody.setVelocity(Phaser.Math.Between(-100, 100), Phaser.Math.Between(-100, 100));
      this.pickups.add(pickup);
    }

    //score display
    this.scoretext = this.add.text(16, 16, 'Cash: $' + this.score, { fontSize: '32px', color: '#000' }).setScrollFactor(0).setDepth(100);;
    this.killtext = this.add.text(900, 16, 'Kills: ' + this.kills, { fontSize: '22px', color: '#9c0b0b' }).setScrollFactor(0).setDepth(100);;


    //this.physics.add.collider(this.player, this.walls);
    //pickup collision logic
   
    this.physics.add.overlap(this.player, this.pickups, this.CollectPickup, undefined, this);


    //enemy spawn
    this.enemies = [
    this.add.rectangle(800, 100, 16, 16, 0xFF2020),
    this.add.rectangle(800, 200, 20, 20, 0xFF2020),
    this.add.rectangle(800, 300, 16, 16, 0xFF2020),
    this.add.rectangle(800, 400, 16, 16, 0xFF2020),
    this.add.rectangle(800, 500, 16, 16, 0xFF2020),
    this.add.rectangle(800, 600, 16, 16, 0xFF2020),
    ]
    
    this.enemies.forEach(enemy => {
    this.physics.add.existing(enemy);
      const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
      enemyBody.setCollideWorldBounds(true);
      this.enemyNextShotTimes.set(
        enemy,
        this.time.now + Phaser.Math.Between(0, this.enemyFireInterval)
      );
      this.enemyShotsFired.set(enemy, 0);
    });
    this.physics.add.collider(this.enemies, this.wallLayer);
    this.physics.add.collider(this.enemies, this.enemies);

    //game over if enemies capture you
    this.physics.add.overlap(this.player, this.enemies, () =>{
      this.score = 0
      this.kills = 0
      this.scene.start('GameOver');
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as any;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.shootAt(pointer.worldX, pointer.worldY);
    });

    if (!this.sound.get('bgmusichill')?.isPlaying) {
      this.sound.add('bgmusichill', { loop: true, volume: 0.05 }).play();
    }
  }

  private shootAt(targetX: number, targetY: number) {

    // dynamic reloading and shooting
    if (this.isReloading) {
      if(this.ammo > 0){
        this.stopReload(); // stopping reloading, starting shooting
      }else{
        return; // out of ammo
      }
    }
    if (this.ammo <= 0) {
      return; // out of ammo
    }
    this.ammo -= 1;
    this.updateAmmoText();
  
     const now = this.time.now;
    //const cursorDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
    //const spread = this.getSpread(now, cursorDistance);
    const spread = this.aimRadius;
    //math stuff for bullet direction and spread
   
    const directionX = targetX - this.player.x;
    const directionY = targetY - this.player.y;
    const distance = Math.sqrt(directionX ** 2 + directionY ** 2);

    const angle = Phaser.Math.FloatBetween(0, 2 * Math.PI);
    const radius = spread * Math.sqrt(Math.random());
    const spreadTargetX = targetX + Math.cos(angle) * radius;
    const spreadTargetY = targetY + Math.sin(angle) * radius;
    
    //testing different way of implementing varied spread OLD CODE BELOW
    this.shotTimes = this.shotTimes.filter(shotTime => now - shotTime < 3000);
    // const isAccurate = this.shotTimes.length < 2;
    this.shotTimes.push(now);
    // const spread = isAccurate ? 0 : Phaser.Math.FloatBetween(-distance * 0.1, distance * 0.1);
    // const spreadTargetX = distance > 0 ? targetX - (directionY / distance) * spread : targetX;
    // const spreadTargetY = distance > 0 ? targetY + (directionX / distance) * spread : targetY;

    this.sound.play('sixshootershot',{ volume: 0.2,detune:Phaser.Math.Between(-100, 100)});
    const bullet = this.add.rectangle(this.player.x, this.player.y, 7, 7, 0x0);
    
    this.physics.add.existing(bullet);
    this.physics.moveTo(bullet, spreadTargetX, spreadTargetY, this.bulletSpeed);
    // coliding with walls and destroying the bullet
    this.physics.add.collider(bullet, this.wallLayer, () => {
      this.sound.play(`ricochet-${Phaser.Math.Between(1, 22)}`,{volume:0.3});
      bullet.destroy();
    });
    //kill enemies will bullet
    this.physics.add.overlap(bullet, this.enemies, (_bullet, enemy) =>{
      bullet.destroy();
      (enemy as Phaser.GameObjects.Rectangle).destroy();

      this.kills += 1
      this.killtext.setText('Kills: ' + this.kills)
      this.sound.play('hitmark',{volume:Phaser.Math.FloatBetween(0.5, 0.7),detune:Phaser.Math.Between(-500, 500)})
      this.sound.play('scream',{volume:Phaser.Math.FloatBetween(0.1, 0.2),detune:Phaser.Math.Between(-150, 800)})

      if(!this.enemies.some(enemy => enemy.active)){
        this.scene.restart()
      }
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

    this.playerBody.setVelocity(dir.x * this.speed, dir.y * this.speed)
    
    this.enemies.forEach(enemy => {
    //if not dead follows player
    if (enemy.active) {
      this.physics.moveTo(
      enemy, this.player.x, this.player.y, this.enemySpeed
    );
      this.tryEnemyShoot(enemy);
    }
  })

    // crosshair aimer logic, this uses the current time based on recent shots fired.
    const pointer = this.input.activePointer;
    const cursorDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    const targetRadius = this.getSpread(this.time.now, cursorDistance);
    // Grows and shrinks the circle smooth 
    this.aimRadius = Phaser.Math.Linear(this.aimRadius, targetRadius, 0.2);
    this.aimCircle.setRadius(this.aimRadius);
    this.aimCircle.setPosition(pointer.worldX, pointer.worldY);
    //console.log("SHOT TIMES AND TARGET RADIUS");
    //console.log(this.shotTimes.length, targetRadius);
    if (Phaser.Input.Keyboard.JustDown(this.reloadKey)) {
      this.startReload();
    } 
  }

  private CollectPickup(_player: Phaser.GameObjects.GameObject, pickup: Phaser.GameObjects.GameObject) {
    //collect pickup and update score
    this.score += 10;
    this.scoretext.setText('Cash: $' + this.score);
    this.sound.play('moneypickup',{ volume: 0.2,detune:Phaser.Math.Between(-100, 100)});
    pickup.destroy();
  }

  private tryEnemyShoot(enemy: Phaser.GameObjects.Rectangle) {
    const now = this.time.now;
    const nextShot = this.enemyNextShotTimes.get(enemy) ?? now;
    if (now < nextShot || !this.hasLineOfSight(enemy)) {
      return;
    }

    const shotsFired = (this.enemyShotsFired.get(enemy) ?? 0) + 1;
    this.enemyShotsFired.set(enemy, shotsFired);
    this.enemyNextShotTimes.set(
      enemy,
      now + (shotsFired >= 6 ? this.enemyReloadTime : this.enemyFireInterval)
    );
    if (shotsFired >= 6) {
      this.enemyShotsFired.set(enemy, 0);
    }

    const direction = new Phaser.Math.Vector2(
      this.player.x - enemy.x,
      this.player.y - enemy.y
    );
    const inaccurateAngle = Phaser.Math.FloatBetween(
      -this.enemySpread,
      this.enemySpread
    );
    direction.rotate(inaccurateAngle).normalize();
    const bullet = this.add.rectangle(enemy.x, enemy.y, 6, 6, 0xffd000);

    this.physics.add.existing(bullet);
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(
      direction.x * this.enemyBulletSpeed,
      direction.y * this.enemyBulletSpeed
    );
    this.physics.add.collider(bullet, this.wallLayer, () => {
      bullet.destroy();
    });
    this.physics.add.overlap(bullet, this.player, () => {
      bullet.destroy();
      this.score = 0;
      this.kills = 0;
      this.scene.start('GameOver');
    });
    this.time.delayedCall(3000, () => bullet.destroy());
  }

  private hasLineOfSight(enemy: Phaser.GameObjects.Rectangle): boolean {
    const distance = Phaser.Math.Distance.Between(
      enemy.x,
      enemy.y,
      this.player.x,
      this.player.y
    );
    const steps = Math.ceil(distance / 8);

    for (let step = 1; step < steps; step += 1) {
      const progress = step / steps;
      const x = Phaser.Math.Linear(enemy.x, this.player.x, progress);
      const y = Phaser.Math.Linear(enemy.y, this.player.y, progress);
      const tile = this.wallLayer.getTileAtWorldXY(x, y);
      if (tile?.collides) {
        return false;
      }
    }

    return true;
  }

  private getSpread(now: number, distance: number): number {
    const recentShots = this.shotTimes.filter(shotTime => this.time.now - shotTime < this.cursorCooldown).length;

    const baseSpread = Math.min(this.minimumSpread + recentShots * this.spreadPerShot, this.maxSpread);

    const distanceScale = Phaser.Math.Clamp(distance/this.range,this.minCircleSize,this.maxCircleSize);
    return baseSpread * distanceScale;
  }

  private startReload(){
    if (this.isReloading || this.ammo >= this.maxAmmo) {
      return;
  }
  this.isReloading = true;
  // reduce player speed while reloading
  if(this.isReloading == true){
    this.speed = 80; 
  }
  else{
    
  }

    this.reloadTimer = this.time.addEvent({
      delay: this.reloadTime,
      loop: true,
      callback: () => {
        this.ammo += 1;
        this.sound.play('sixshooterinsert',{ volume: 0.2,detune:Phaser.Math.Between(-100, 100)});
  this.updateAmmoText();
        if (this.ammo >= this.maxAmmo) {
          this.stopReload();
        }else{
          this.updateAmmoText();
        }
      }
    });
  }

  private stopReload() {
    //reseting speed
    this.speed = 100;
    this.isReloading = false;
    this.reloadTimer?.remove();
    this.reloadTimer = undefined;
    this.updateAmmoText();
    this.sound.play('sixshootercylinder',{ volume: 0.2,detune:Phaser.Math.Between(-100, 100)});
  }
  private updateAmmoText() {
    const text = this.isReloading ? 'Reloading : ' : 'Ammo: ';
    this.ammoText.setText(text + this.ammo + '/' + this.maxAmmo);
  }

}