import * as Phaser from 'phaser';
import { Boot } from './scenes/Boot.ts';
import { Preloader } from './scenes/Preloader.ts';
import { MainMenu } from './scenes/MainMenu.ts';
import { GameScene } from './scenes/GameScene.ts';
import { GameOver } from './scenes/GameOver.ts';

const config: Phaser.Types.Core.GameConfig = {
  autoFocus: false,
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [Boot, Preloader, MainMenu, GameScene, GameOver],
};

const StartGame = (parent: string) => {
  const game = new Phaser.Game({ ...config, parent });

  // Celbridge previews the page in an iframe, so clicking the game must give it keyboard focus
  const container = document.getElementById(parent)!;
  container.tabIndex = 0;
  container.style.outline = 'none';
  container.addEventListener('pointerdown', () => container.focus({ preventScroll: true }));
  return game;
};

export default StartGame;