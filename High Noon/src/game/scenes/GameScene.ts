import * as Phaser from 'phaser';

export class GameScene extends Phaser.Scene {


  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private walls!: Phaser.GameObjects.Rectangle[];
  private enemies!: Phaser.GameObjects.Rectangle[];
  private enemySpeed = 60;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private shotTimes: number[] = [];
  private speed = 160;
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
  private cursorCooldown = 1200; // in milliseconds, how long to wait before the circle shrinks again for each shot

  //Reloading variables
  private maxAmmo = 6;
  private reloadTime = 500; // in milliseconds per bullet
  private ammo = 6
  private isReloading = false;
  private reloadTimer?: Phaser.Time.TimerEvent;
  private reloadKey!: Phaser.Input.Keyboard.Key;
  private ammoText!: Phaser.GameObjects.Text; // displaying amount of ammo

  constructor() {
    super('GameScene');
  }

  create() {
    this.reloadKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    this.ammoText = this.add.text(16,52,'', {fontSize:'24px',color:'#000'});
    this.ammo = this.maxAmmo
    this.updateAmmoText();
    //Creating the cursor aimer
    this.aimCircle = this.add.circle(0, 0, this.aimRadius, 0xff0000, 0.25).setStrokeStyle(1, 0xff0000, 0.5).setDepth(10);
    this.input.setDefaultCursor('crosshair')


    this.cameras.main.setBackgroundColor('#c2a36b');

    this.walls = [
      this.add.rectangle(300, 200, 200, 32, 0x6b4f2a),
      this.add.rectangle(550, 400, 32, 200, 0x6b4f2a),
    ];
    this.walls.forEach(w => this.physics.add.existing(w, true));

    this.player = this.add.rectangle(100, 100, 16, 16, 0x0f4d0f);
    this.physics.add.existing(this.player);
    //make the pickups
    this.pickups = this.physics.add.group();
    for (let index = 0; index < 6; index += 1) {
      //random pickup spawn positions
      let spawnX = 0;
      let spawnY = 0;
      let overlapsWall = true;
      //CHECK FOR WALLS
      while (overlapsWall) {
        spawnX = Phaser.Math.Between(24, this.scale.width - 24);
        spawnY = Phaser.Math.Between(24, this.scale.height - 24);
        const pickupBounds = new Phaser.Geom.Rectangle(spawnX - 6, spawnY - 6, 12, 12);
        overlapsWall = this.walls.some(wall =>
          Phaser.Geom.Intersects.RectangleToRectangle(pickupBounds, wall.getBounds())
        );
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
    this.scoretext = this.add.text(16, 16, 'Cash: $' + this.score, { fontSize: '32px', color: '#000' });
    this.killtext = this.add.text(900, 16, 'Kills: ' + this.kills, { fontSize: '22px', color: '#9c0b0b' });

    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.walls);
    //pickup collision logic
    this.physics.add.collider(this.pickups, this.walls);
    this.physics.add.overlap(this.player, this.pickups, this.CollectPickup, undefined, this);


    //enemy spawn
    this.enemies = [
    this.add.rectangle(800, 100, 20, 20, 0xFF2020),
    this.add.rectangle(800, 200, 20, 20, 0xFF2020),
    this.add.rectangle(800, 300, 20, 20, 0xFF2020),
    this.add.rectangle(800, 400, 20, 20, 0xFF2020),
    this.add.rectangle(800, 500, 20, 20, 0xFF2020),
    this.add.rectangle(800, 600, 20, 20, 0xFF2020),
    ]
    
    this.enemies.forEach(enemy => {
    this.physics.add.existing(enemy);
      const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
      enemyBody.setCollideWorldBounds(true);
    });
    this.physics.add.collider(this.enemies, this.walls);
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
     const spread = this.getSpread(now);
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
    this.physics.add.collider(bullet, this.walls, () => {
      this.sound.play(`ricochet-${Phaser.Math.Between(1, 22)}`,{volume:0.3});
      bullet.destroy();
    });
    //kill enemies will bullet
    this.physics.add.overlap(bullet, this.enemies, (_bullet, enemy) =>{
      bullet.destroy();
      (enemy as Phaser.GameObject.Rectangle).destroy();

      this.kills += 1
      this.killtext.setText('Kills: ' + this.kills)
      this.sound.play('hitmark',{volume:0.6})

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
    
    this.playerBody.setVelocity(dir.x * this.speed, dir.y * this.speed);
    this.enemies.forEach(enemy => {
    //if not dead follows player
    if (enemy.active) {
      this.physics.moveTo(
      enemy, this.player.x, this.player.y, this.enemySpeed
    );
    }
  })

    // crosshair aimer logic, this uses the current time based on recent shots fired.
    const pointer = this.input.activePointer;
    const targetRadius = this.getSpread(this.time.now);
    // Grows and shrinks the circle smooth 
    this.aimRadius = Phaser.Math.Linear(this.aimRadius, targetRadius, 0.2);
    this.aimCircle.setRadius(this.aimRadius);
    this.aimCircle.setPosition(pointer.worldX, pointer.worldY);
    console.log("SHOT TIMES AND TARGET RADIUS");
    console.log(this.shotTimes.length, targetRadius);
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

  private getSpread(now: number): number {
    const recentShots = this.shotTimes.filter(shotTime => this.time.now - shotTime < this.cursorCooldown).length;
    return Math.min(this.minimumSpread + recentShots * this.spreadPerShot, this.maxSpread);
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
    this.speed = 160;
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