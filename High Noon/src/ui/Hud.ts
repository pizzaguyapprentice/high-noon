import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance.ts';
import type { Player } from '../entities/Player.ts';
import type { Level } from '../world/Level.ts';
import type { AmmoState } from '../systems/Weapon.ts';

const LIGHT_PANEL = { backgroundColor: '#cdc3a5', padding: { x: 8, y: 4 } };
const DARK_PANEL = { backgroundColor: '#2a2a2a', padding: { x: 8, y: 4 } };

export class Hud {
  private scene: Phaser.Scene;
  private cashText: Phaser.GameObjects.Text;
  private ammoText: Phaser.GameObjects.Text;
  private hotbarTexts: Phaser.GameObjects.Text[] = [];
  private lastSelectedSlot = -1;
  private hotbarHideTimer?: Phaser.Time.TimerEvent;
  private killText: Phaser.GameObjects.Text;
  private bountyText: Phaser.GameObjects.Text;
  private healthBar: Phaser.GameObjects.Image;

  hudGroup: Phaser.GameObjects.Group;
  minimap;
  playerDot: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, player: Player, level: Level) {
    this.scene = scene;
    this.cashText = this.pin(scene.add.text(16, 16, '', {
      fontSize: '32px', color: 'green', ...LIGHT_PANEL,
    }));
    this.ammoText = this.pin(scene.add.text(16, 52, '', {
      fontSize: '24px', color: '#e00606', ...LIGHT_PANEL,
    }));
    for (let i = 0; i < 5; i += 1) {
      this.hotbarTexts.push(this.pin(scene.add.text(20, 240 + i * 40, '', {
        fontSize: '24px', ...LIGHT_PANEL,
      })));
    }
    this.bountyText = this.pin(scene.add.text(850, 16, '', {
      fontSize: '22px', color: '#e00606', ...DARK_PANEL,
    }));
    this.killText = this.pin(scene.add.text(850, 45, '', {
      fontSize: '22px', color: '#e00606', ...DARK_PANEL,
    }));
    this.healthBar = scene.add.image(70, 170, 'health4')
    .setDisplaySize(120,120)
    .setScrollFactor(0)
    .setDepth(100);
    
    
    this.hudGroup = scene.add.group([ 

    this.cashText,
    this.ammoText,
    ...this.hotbarTexts,
    this.bountyText,
    this.killText,
    this.healthBar,

    ]);
    const minimapH = 250;
    const minimapW = 250;

    this.minimap = scene.cameras.add(
    scene.scale.width - minimapW - 15,
    scene.scale.height - minimapH- 15,
    minimapW,
    minimapH,
    );

    this.minimap.setZoom(0.1);
    this.minimap.startFollow(player, true);
    this.minimap.setBounds(0, 0, level.width, level.height);
    this.minimap.ignore(this.hudGroup);

    const minimapBorder = scene.add.rectangle(
    this.minimap.centerX,
    this.minimap.centerY,
    this.minimap.width + 10,
    this.minimap.height + 10,  0x0);

    minimapBorder.setScrollFactor(0);
    minimapBorder.setDepth(100);
    this.minimap.ignore(minimapBorder); 
    
    scene.input.keyboard!.on('keydown-M', (_event: KeyboardEvent) =>{
      this.minimap.setVisible(!this.minimap.visible);
      minimapBorder.setVisible(!minimapBorder.visible);
      
    })

    this.playerDot = scene.add.circle(player.x, player.y, 70, 0x0);
    this.playerDot.setDepth(100);
    //so doesnt show on main non minimap screen
    scene.cameras.main.ignore(this.playerDot);
  }

  setHealth(health: number){
    this.healthBar.setTexture(`health${health}`)
  }

  setCash(amount: number) {
    this.cashText.setText(`Cash: $${amount}`);
  }

  setKills(kills: number) {
    this.killText.setText(`Kills: ${kills}`);
    this.bountyText.setText(`Bounty: $${kills * BALANCE.economy.bountyPerKill}`);
  }

  setAmmo(state: AmmoState) {
    if (state.selectedSlot !== this.lastSelectedSlot) {
      this.lastSelectedSlot = state.selectedSlot;
      this.hotbarHideTimer?.remove();
      this.hotbarTexts.forEach((text) => text.setVisible(true));
      this.hotbarHideTimer = this.scene.time.delayedCall(1500, () => this.hideInactiveHotbarSlots());
    }

    const prefix = state.reloading ? 'Reloading : ' : 'Ammo: ';
    this.ammoText.setText(`${prefix}${state.ammo}/${state.maxAmmo}`);
    state.slots.forEach((slot, index) => {
      this.hotbarTexts[index].setText(`${index + 1}: ${slot.label} ${slot.ammo}/${slot.maxAmmo}`);
      this.hotbarTexts[index].setColor(index === state.selectedSlot ? '#e00606' : '#2a0f0f');
    });
  }

  private hideInactiveHotbarSlots() {
    this.hotbarTexts.forEach((text, index) => text.setVisible(index === this.lastSelectedSlot));
    this.hotbarHideTimer = undefined;
  }

  private pin(text: Phaser.GameObjects.Text) {
    return text.setScrollFactor(0).setDepth(100);
  }
}
