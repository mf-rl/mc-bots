// multibots.js
const createBot = require('./wanderbot');

function generateRandomName() {
  const adjectives = ["Swift","Silent","Iron","Shadow","Crimson","Frost","Storm","Wild","Lone","Night"];
  const nouns = ["Wolf","Falcon","Tiger","Eagle","Raven","Panther","Dragon","Viper","Hawk","Bear"];
  return `${adjectives[Math.floor(Math.random()*adjectives.length)]}${nouns[Math.floor(Math.random()*nouns.length)]}${Math.floor(Math.random()*9999)}`;
}

const MAX_BOTS = 5;
const SPAWN_MIN = 15000;
const SPAWN_RANGE = 30000;
let currentBots = 0;

const sharedState = { bots: [], target: null, lastSeen: 0 };

function spawnBot() {
  if (currentBots>=MAX_BOTS) return setTimeout(spawnBot, SPAWN_MIN);

  const botName = generateRandomName();
  console.log(`[Spawner] Bot ${botName} spawning...`);
  currentBots++;

  createBot(botName,'localhost',25565,sharedState,()=>{
    currentBots--;
    sharedState.bots = sharedState.bots.filter(b=>b.username!==botName);
  });

  const delay = SPAWN_MIN + Math.floor(Math.random()*SPAWN_RANGE) + sharedState.bots.length*1500;
  setTimeout(spawnBot, delay);
}

spawnBot();

setInterval(()=>{
  const onlineBots = sharedState.bots.filter(b=>b.botRef).map(b=>b.username);
  console.log(`[Spawner] Online bots: ${onlineBots.join(', ')||'none'}`);
  if(sharedState.target) console.log(`[Spawner] Current target: ${sharedState.target}`);
},15000);
