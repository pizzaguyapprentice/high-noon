# Installing Deno

This project is built with [Deno](https://deno.com). Celbridge uses it, and so does working without Celbridge
(see `README_deno_tooling.md`). Install it once, and it works for every Deno project.

There's no Linux version of Celbridge yet, so on Linux you'll use Deno on its own, as in `README_deno_tooling.md`.

## Linux

The official install script works on any Linux distribution. It needs `curl` and `unzip`, so install those first
if you don't have them:

| Distribution | Install curl and unzip |
|---|---|
| Ubuntu, Debian, Mint | `sudo apt install curl unzip` |
| Fedora | `sudo dnf install curl unzip` |
| Arch, Manjaro | `sudo pacman -S curl unzip` |

Then install Deno (no `sudo` needed; it installs into `~/.deno` in your home folder):

```
curl -fsSL https://deno.land/install.sh | sh
```

The script asks whether to add Deno to your `PATH`: answer yes. Then **close the terminal and open a new one**,
so it picks up the change. If `deno` still isn't found, add these two lines to the end of `~/.bashrc` (or
`~/.zshrc` if you use zsh), then open a new terminal:

```
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
```

On Arch and Manjaro you can use the package manager instead: `sudo pacman -S deno`.

If you used the install script, update Deno later with `deno upgrade`. (With `pacman`, it updates with the
rest of your system.)

## macOS and Windows

| System | Command |
|---|---|
| macOS | `curl -fsSL https://deno.land/install.sh \| sh` |
| macOS (Homebrew) | `brew install deno` |
| Windows (PowerShell) | `irm https://deno.land/install.ps1 \| iex` |
| Windows (winget) | `winget install DenoLand.Deno` |

## Check it worked

You need version 2 or later:

```
deno --version
```
