import { GameObjects, Scene } from "phaser";

interface MenuData {
  pauseGame?: boolean;
}

const TEXT_STYLE = {
  fontFamily: "Arial Black",
  fontSize: 28,
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 6,
};

export class MainMenu extends Scene {
  private pauseGame = false;
  private menuItems: GameObjects.Text[] = [];

  constructor() {
    super("MainMenu");
  }

  init(data: MenuData = {}) {
    this.pauseGame = data.pauseGame === true;
    this.registry.set("muted", this.registry.get("muted") === true);
    this.sound.mute = this.registry.get("muted");
  }

  create() {
    this.drawMenu();

    if (this.pauseGame) {
      this.input.keyboard?.on("keydown-ESC", this.closePauseMenu, this);
      this.events.once("shutdown", () => {
        this.input.keyboard?.off("keydown-ESC", this.closePauseMenu, this);
      });
    }
  }

  private drawMenu() {
    this.menuItems = [];
    this.add.image(512, 384, "background");
    this.add.rectangle(512, 384, 1024, 768, 0x0b1018, this.pauseGame ? 0.72 : 0.1);
    this.add.image(512, 240, "logo").setScale(0.85);

    this.showMainMenu();
  }

  private showMainMenu() {
    this.clearMenuItems();
    if (this.pauseGame) {
      this.addMenuText(512, 350, "Paused", {
        ...TEXT_STYLE,
        fontSize: 42,
      });
    }
    this.addButton(512, 440, "PLAY", () => {
      if (this.pauseGame) {
        this.closePauseMenu();
      } else {
        this.scene.start("GameScene");
      }
    });
    this.addButton(512, 500, "OPTIONS", () => this.showOptions());

    if (this.pauseGame) {
      this.addMenuText(512, 700, "Press ESC to resume", {
        ...TEXT_STYLE,
        fontSize: 18,
      });
    }
  }

  private showOptions() {
    this.clearMenuItems();
    this.addMenuText(512, 410, "OPTIONS", {
      ...TEXT_STYLE,
      fontSize: 32,
    });

    const muted = this.registry.get("muted") === true;
    this.addButton(512, 475, muted ? "SOUND: OFF" : "SOUND: ON", () => {
      const nextMuted = !(this.registry.get("muted") === true);
      this.registry.set("muted", nextMuted);
      this.sound.mute = nextMuted;
      this.showOptions();
    });
    this.addButton(512, 535, "CONTROLS", () => this.showControls());
    this.addButton(512, 595, "BACK", () => this.showMainMenu());
  }

  private showControls() {
    this.clearMenuItems();
    this.addMenuText(512, 390, "CONTROLS", {
      ...TEXT_STYLE,
      fontSize: 32,
    });
    this.addMenuText(512, 490, [
      "WASD / ARROW KEYS  Move",
      "MOUSE / SPACE  Fire",
      "R  Reload",
      "SHIFT  Dodge",
      "1 - 4  Select weapon",
      "M  Toggle minimap",
      "ESC  Open menu",
    ], {
      ...TEXT_STYLE,
      fontFamily: "Arial",
      fontSize: 20,
      align: "center",
      lineSpacing: 8,
    });
    this.addButton(512, 650, "BACK", () => this.showOptions());
  }

  private addMenuText(x: number, y: number, text: string | string[], style: Phaser.Types.GameObjects.Text.TextStyle) {
    const item = this.add.text(x, y, text, style).setOrigin(0.5);
    this.menuItems.push(item);
    return item;
  }

  private addButton(x: number, y: number, label: string, callback: () => void) {
    const button = this.add.text(x, y, label, TEXT_STYLE)
      .setOrigin(0.5)
      .setPadding(12, 6)
      .setInteractive({ useHandCursor: true });

    button.on("pointerover", () => button.setColor("#ffd447"));
    button.on("pointerout", () => button.setColor(TEXT_STYLE.color));
    button.on("pointerdown", callback);
    this.menuItems.push(button);
  }

  private clearMenuItems() {
    this.menuItems.forEach((item) => item.destroy());
    this.menuItems = [];
  }

  private closePauseMenu = () => {
    if (!this.pauseGame) {
      return;
    }
    this.scene.stop();
    this.scene.resume("GameScene");
  };
}
