# Minecraft Bots

Automated Minecraft bot swarm with AI-powered name generation.

## Features

- 🤖 Multiple bots spawning and wandering
- 🎯 PVP combat capabilities
- 🔄 Auto-reconnect on disconnect
- 🌐 External API integration for AI name generation
- 🐳 Docker support for easy deployment

## Quick Start

### Using Docker (Recommended)

**1. Pull the image:**
```bash
docker pull yourusername/mc-bots:latest
```

**2. Create a `config.json`:**
```json
{
  "maxBots": 30,
  "spawnMin": 20000,
  "spawnRange": 40000,
  "server": {
    "host": "your-minecraft-server.com",
    "port": 25565
  },
  "api": {
    "host": "your-name-api.com",
    "port": 3000
  }
}
```

**3. Run the container:**
```bash
docker run -d \
  --name mc-bots \
  -v $(pwd)/config.json:/app/config.json:ro \
  --restart unless-stopped \
  yourusername/mc-bots:latest
```

### Using Node.js

**1. Install dependencies:**
```bash
npm install
```

**2. Configure `config.json`**

**3. Start the bots:**
```bash
npm start
```

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `maxBots` | Maximum number of concurrent bots | `3` |
| `spawnMin` | Minimum spawn delay (ms) | `20000` |
| `spawnRange` | Random spawn delay range (ms) | `40000` |
| `server.host` | Minecraft server address | `localhost` |
| `server.port` | Minecraft server port | `25565` |
| `api.host` | Name generation API host | `localhost` |
| `api.port` | Name generation API port | `3000` |

## Docker Deployment

### Build locally:
```bash
docker build -t mc-bots .
```

### Run with custom config:
```bash
docker run -d \
  --name mc-bots \
  -v /path/to/config.json:/app/config.json:ro \
  --restart unless-stopped \
  mc-bots
```

### Run with environment network:
```bash
docker run -d \
  --name mc-bots \
  --network host \
  -v $(pwd)/config.json:/app/config.json:ro \
  mc-bots
```

### View logs:
```bash
docker logs -f mc-bots
```

### Stop bots:
```bash
docker stop mc-bots
```

## Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mc-bots:
    image: yourusername/mc-bots:latest
    container_name: mc-bots
    volumes:
      - ./config.json:/app/config.json:ro
    restart: unless-stopped
    network_mode: host
```

Run with:
```bash
docker-compose up -d
```

## GitHub Actions CI/CD

This repository includes automated Docker builds:

**Setup:**
1. Add Docker Hub secrets to your GitHub repository:
   - `DOCKERHUB_USERNAME`: Your Docker Hub username
   - `DOCKERHUB_TOKEN`: Docker Hub access token

2. Push to `main` branch or create a tag:
```bash
# Push triggers build with 'latest' tag
git push origin main

# Tag triggers versioned build
git tag v1.0.0
git push origin v1.0.0
```

**Automated builds:**
- ✅ Push to main → `latest` tag
- ✅ Git tags → version tags (`v1.0.0`, `v1.0`, `v1`)
- ✅ Multi-arch builds (amd64, arm64)
- ✅ Docker Hub description sync

## Performance Recommendations

For Oracle Cloud VM.Standard.A1.Flex (4 OCPU, 24GB RAM):
- **Recommended:** 30-50 bots
- **Maximum:** 60 bots (with monitoring)
- Monitor server TPS and adjust `maxBots` accordingly

## Name Generation API

This bot client requires a separate name generation API service. Check the API repository for setup instructions.

**API Endpoint:**
```
GET http://api-host:3000/api/generate-name
```

**Response:**
```json
{
  "name": "CrimsonDragon4582",
  "provider": "groq"
}
```

## Bot Behavior

- Wanders randomly around spawn area
- Engages in PVP when players/entities are nearby
- Auto-respawns after death
- Reconnects on disconnect
- Reports status every 15 seconds

## License

ISC

## Links

- Docker Hub: https://hub.docker.com/r/yourusername/mc-bots
- GitHub: https://github.com/yourusername/mc-bots
