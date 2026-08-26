# QACKER
penetration  testing and hacking dashboard.

## CyberStrike Dashboard

A web dashboard for driving the CyberStrike arsenal from a single UI:

* **nmap** · **nikto** · **sqlmap** · **nuclei** · **ffuf** · **httpx**
* **subfinder** · **katana** · **dalfox** · **waybackurls**
* **metasploit** (`msfconsole` + `msfvenom`) · **SecLists**

Each tool has a form built from its most common flags/options. The server
builds an argument array (never a shell string) and spawns the corresponding
binary, so user input can never be interpreted as shell syntax. The tools
themselves must already be installed and available on `PATH` in the
environment running the dashboard.

### Setup

```bash
npm install
npm start
```

The dashboard is served at `http://localhost:3000` (override with the `PORT`
environment variable).

### SecLists wordlist browser

The dashboard can browse a local [SecLists](https://github.com/danielmiessler/SecLists)
checkout so you can copy wordlist paths into tools like `ffuf`. Point the
dashboard at your checkout with the `SECLISTS_PATH` environment variable, or
clone SecLists into `./SecLists` (ignored by git) at the project root.

### Tests

```bash
npm test
```

### Security notes

* Every tool invocation uses `child_process.spawnSync` with `shell: false`
  and a fixed argument array — user-supplied values are never concatenated
  into a shell command string.
* The SecLists browser resolves and validates paths to stay within the
  configured root directory, preventing path traversal.
* This dashboard executes real offensive security tooling. Only run it
  against systems you are authorized to test.
