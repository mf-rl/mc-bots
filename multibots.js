const createBot = require('./wanderbot');
const fs = require('fs');
const path = require('path');

// Load configuration
let config = {
  maxBots: 3,
  spawnMin: 20000,
  spawnRange: 40000,
  server: { host: 'localhost', port: 25565 },
  api: {
    host: 'localhost',
    port: 3000
  }
};

try {
  const configPath = path.join(__dirname, 'config.json');
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = { ...config, ...JSON.parse(configFile) };
  console.log('[Spawner] Configuration loaded from config.json');
} catch (err) {
  console.log('[Spawner] Using default configuration');
}

async function generateNameWithAPI() {
  try {
    const apiHost = config.api?.host || 'localhost';
    const apiPort = config.api?.port || 3000;
    const apiUrl = `http://${apiHost}:${apiPort}/api/generate-name`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    if (data.name) {
      console.log(`[NameGen] Generated name from API: ${data.name}`);
      return data.name;
    }
  } catch (err) {
    console.log(`[NameGen] API call failed: ${err.message}`);
  }
  return null;
}

function generateRandomName() {
  // Simple fallback if API is completely unavailable
  return `Bot${Math.floor(Math.random()*9999)}`;
}

const MAX_BOTS = config.maxBots;
const SPAWN_MIN = config.spawnMin;
const SPAWN_RANGE = config.spawnRange;
let currentBots = 0;

const sharedState = { bots: [], target: null, lastSeen: 0 };

async function spawnBot() {
  if (currentBots>=MAX_BOTS) return setTimeout(spawnBot, SPAWN_MIN);

  let botName = await generateNameWithAPI();
  if (!botName) botName = generateRandomName();
  
  console.log(`[Spawner] Bot ${botName} spawning...`);
  currentBots++;

  createBot(botName, config.server.host, config.server.port, sharedState, ()=>{
    currentBots--;
    sharedState.bots = sharedState.bots.filter(b=>b.username!==botName);
  });

  const delay = SPAWN_MIN + Math.floor(Math.random()*SPAWN_RANGE) + sharedState.bots.length*3000;
  console.log(`[Spawner] Next bot in ${Math.round(delay/1000)}s`);
  setTimeout(spawnBot, delay);
}

spawnBot();

setInterval(()=>{
  const onlineBots = sharedState.bots.filter(b=>b.botRef).map(b=>b.username);
  console.log(`[Spawner] Online bots: ${onlineBots.join(', ')||'none'}`);
  if(sharedState.target) console.log(`[Spawner] Current target: ${sharedState.target}`);
},15000);
