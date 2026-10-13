import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance';

const LIGHT_PANEL = { backgroundColor: '#cdc3a5', padding: { x: 8, y: 4 } };
const DARK_PANEL = { backgroundColor: '#2a2a2a', padding: { x: 8, y: 4 } };

export class Hud {
  private cashText: Phaser.GameObjects.Text;
  private ammoText: Phaser.GameObjects.Text;
  private killText: Phaser.GameObjects.Text;
  private bountyText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.cashText = this.pin(scene.add.text(16, 16, '', {
      fontSize: '32px', color: 'green', ...LIGHT_PANEL,
    }));
    this.ammoText = this.pin(scene.add.text(16, 52, '', {
      fontSize: '24px', color: '#e00606', ...LIGHT_PANEL,
    }));
    this.bountyText = this.pin(scene.add.text(850, 16, '', {
      fontSize: '22px', color: '#e00606', ...DARK_PANEL,
    }));
    this.killText = this.pin(scene.add.text(850, 45, '', {
      fontSize: '22px', color: '#e00606', ...DARK_PANEL,
    }));
  }

  setCash(amount: number) {
    this.cashText.setText(`Cash: $${amount}`);
  }

  setKills(kills: number) {
    this.killText.setText(`Kills: ${kills}`);
    this.bountyText.setText(`Bounty: $${kills * BALANCE.economy.bountyPerKill}`);
  }

  setAmmo(ammo: number, maxAmmo: number, reloading: boolean) {
    const prefix = reloading ? 'Reloading : ' : 'Ammo: ';
    this.ammoText.setText(`${prefix}${ammo}/${maxAmmo}`);
  }

  private pin(text: Phaser.GameObjects.Text) {
    return text.setScrollFactor(0).setDepth(100);
  }
}