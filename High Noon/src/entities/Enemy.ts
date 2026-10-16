import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';
import { ReloadBar } from '../ui/ReloadBar.ts';
import {ENEMY_STATES,type EnemyPerception, type EnemyStateKey} from '../ai/EnemyStates.ts';
import { StateMachine } from '../ai/StateMachine.ts';
const ARRIVE_DISTANCE = 6;

export class Enemy extends Phaser.GameObjects.Rectangle {
  
  declare body: Phaser.Physics.Arcade.Body;
  
  lastKnownTarget = new Phaser.Math.Vector2();
  searchUntil = 0;
  private ai : StateMachine<Enemy, EnemyPerception, EnemyStateKey>;


  private nextShotAt: number;
  private shotsFired = 0;
  private reloadUntil = 0;
  private reloadBar: ReloadBar;
  enemyDot;

  constructor(scene: Phaser.Scene, x: number, y: number, size = 16) {
    super(scene, x, y, size, size, 0xff2020);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setCollideWorldBounds(true);
    this.enemyDot = scene.add.circle(x, y, 50, 0x0);
    this.enemyDot.setDepth(100);
    scene.cameras.main.ignore(this.enemyDot);

    this.reloadBar = new ReloadBar(scene, 0xe74c3c);
    //Stagger the first shot so enemies don't all fire on the same frame
    this.nextShotAt = scene.time.now + Phaser.Math.Between(0, BALANCE.enemy.fireInterval);
    this.ai = new StateMachine<Enemy,EnemyPerception,EnemyStateKey>(this,ENEMY_STATES,"idle");
  }

  get aiState(): EnemyStateKey{
    return this.ai.current;
  }

  think(perception: EnemyPerception){
    this.ai.update(perception);
  }

  chase(target: { x: number; y: number }, kills: number) {
    const bonus = Math.min(kills, BALANCE.enemy.killScalingCap) * BALANCE.enemy.speedPerKill;
    this.scene.physics.moveTo(this, target.x, target.y, BALANCE.enemy.speed + bonus);
  }

  moveToward(point:{x:number,y:number}, speed:number):boolean{
      if(Phaser.Math.Distance.Between(this.x,this.y,point.x,point.y) <= ARRIVE_DISTANCE){
        this.stop();
        return true;
      }
      this.scene.physics.moveTo(this, point.x,point.y,speed);
      return false;
  }

  stop(){
    this.body.setVelocity(0,0);
  }

  isReadyToFire(now: number): boolean {
    return this.active && now >= this.nextShotAt;
  }

  delayFiring(now:number, ms:number){
    this.nextShotAt = Math.max(this.nextShotAt, now + ms);
  }

  registerShot(now: number, kills: number) {
    this.shotsFired += 1;

    if (this.shotsFired >= BALANCE.enemy.clipSize) {
      this.shotsFired = 0;
      this.reloadUntil = now + BALANCE.enemy.reloadTime;
      this.nextShotAt = this.reloadUntil;
      return;
    }

    const fasterBy = Math.min(kills, BALANCE.enemy.killScalingCap) * BALANCE.enemy.fireIntervalPerKill;
    this.nextShotAt = now + BALANCE.enemy.fireInterval - fasterBy;
  }

    showAlert(symbol: string) {
    const text = this.scene.add.text(this.x, this.y - 20, symbol, {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffd000',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(22);
 
    this.scene.tweens.add({
      targets: text,
      y: text.y - 14,
      alpha: 0,
      delay: 350,
      duration: 450,
      onComplete: () => text.destroy(),
    });
  }

  updateReloadBar(now: number) {
    this.enemyDot.setPosition(this.x, this.y);
    const remaining = this.reloadUntil - now;
    if (remaining > 0) {
      this.reloadBar.show(this.x, this.y, 1 - remaining / BALANCE.enemy.reloadTime, remaining);
    } else {
      this.reloadBar.hide();
    }
  }

  destroy(fromScene?: boolean) {
    this.enemyDot?.destroy();
    this.reloadBar?.destroy();
    super.destroy(fromScene);
  }
}