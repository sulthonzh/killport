# killport

Kill whatever's running on a port. Zero deps.

```bash
npx killport 3000
# killed pid 48291 (node) on port 3000 [SIGTERM]
```

## Why

Every dev has been here — you start a server and get "port already in use". You fumble around with `lsof -i :3000`, copy the PID, then `kill -9 <pid>`. Every. Single. Time.

`killport` does it in one command. Works on macOS and Linux. Windows too (with `netstat`/`taskkill`).

## Install

```bash
npm install -g killport
```

Or just use it once:

```bash
npx killport 3000
```

## Usage

```bash
# Kill whatever's on port 3000
killport 3000

# Force kill (SIGKILL)
killport 3000 -f

# List what's on a port without killing
killport 3000 -l

# JSON output
killport 3000 -l -j

# Scan common ports for listeners
killport scan

# Scan ALL ports (slower)
killport scan -a
```

## Scan Output

```
$ killport scan
    22  pid    352  sshd
  3000  pid  48291  node
  5432  pid    712  postgres
  8080  pid  12340  python

4 listeners found
```

## Options

| Flag | Description |
|------|-------------|
| `-f, --force` | Kill with SIGKILL instead of SIGTERM |
| `-s, --signal <sig>` | Custom signal (SIGTERM, SIGKILL, etc.) |
| `-l, --list` | List only, don't kill |
| `-j, --json` | JSON output |
| `scan` | Scan for listening ports |
| `-a, --all` | Scan all ports (with scan) |

## Exit Codes

- `0` — success (killed or nothing to kill)
- `1` — kill failed
- `2` — invalid arguments

## License

MIT
