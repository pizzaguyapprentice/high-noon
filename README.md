## HIGH NOON ##

High Noon is a top down run and gun game. Once a Lutheran, Lars crossed the Rubicon and never looked back. Now, he’s on a warpath entirely he calls his own. Your goal is to rack up the highest possible bounty and find out more about Lars and the man he became.

### Controls
- WASD - Movement
- LMB/Space - Shoot
- R - Reload
- Shift - Roll+Reload (invincibility frames + 1 free reload)
- M - Toggle the mini map

### HUD
Currently the HUD shows:
- Money collected
- Current Ammo / Max Ammo
- Weapon selected
- Your Bounty
- Total Kills
- Health

### Weapons
- Colt Single Action Army 
- Colt Model 1878 Hammer Shotgun 
- Winchester Model 1873 lever-action

### Enemies
- State Machine:
  - Idle - self-explanatory
  - Advancing - when perceived, the enemy will head towards your position, annotated by a "!"
  - Seeking - if lost sight of the player, the enemy will head towards your last seen position, annotated by a "?"
- Pathfinding:
  - EasyStar.js
- Reloads once magazine has been expended.
- Upon melee proximity, the player will lose a life.

### Level
Mapped out using Tiled and tiles created using LibreSprite.

### SFX and Music
Sourced from the internet.

### Pickups
Only $$$ for now.
