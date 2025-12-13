// wanderbot.js
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const { Vec3 } = require('vec3');
const mcDataLib = require('minecraft-data');

function createBot(username, host, port, sharedState = {}, onFinalEnd = () => {}, attempt = 1) {
  const bot = mineflayer.createBot({
    host,
    port,
    username,
    hideErrors: true,
    version: "1.21.1",
    auth: "offline"
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  sharedState.bots = sharedState.bots || [];
  sharedState.bots.push({ username, botRef: null });

  // ---- Survival helpers ----
  async function tryAutoEat() {
    try {
      if (!bot.food || bot.food >= 16) return;
      const food = bot.inventory.items().find(i => /beef|pork|bread|apple|carrot/.test(i.name));
      if (!food) return;
      await bot.equip(food, 'hand');
      try { bot.activateItem(); setTimeout(() => { try { bot.deactivateItem(); } catch {} }, 1200); } catch {}
    } catch {}
  }

  async function craftItem(recipeName) {
    try {
      const mcData = mcDataLib(bot.version);
      const recipe = bot.recipesFor(mcData.itemsByName[recipeName].id, null, 1)[0];
      if (recipe) await bot.craft(recipe, 1);
    } catch {}
  }

  // ---- AI loop ----
  function startAILoops() {
    setInterval(async () => {
      if (!bot.entity) return;

      // Update shared target
      updateSharedTarget();

      // Combat vs players
      if (sharedState.target) {
        const targetName = sharedState.target;
        const targetEntity = bot.players[targetName]?.entity;
        if (targetEntity) {
          const dist = bot.entity.position.distanceTo(targetEntity.position);
          if (dist <= 3.5) engageMelee(targetEntity);
          else flankAndApproach(targetEntity);
        } else if (Date.now() - (sharedState.lastSeen || 0) > 15000) {
          sharedState.target = null;
        }
      } else {
        // Survival: eat, wander, gather
        tryAutoEat();
        if (Math.random() < 0.1) wander();
      }
    }, 800);
  }

  // ---- Shared target detection ----
  function updateSharedTarget() {
    const players = Object.values(bot.players)
      .filter(p => p.entity && !sharedState.bots.some(b => b.username === p.username));

    if (players.length === 0) return;

    players.sort((a, b) =>
      bot.entity.position.distanceTo(a.entity.position) -
      bot.entity.position.distanceTo(b.entity.position)
    );

    const nearest = players[0];
    const d = bot.entity.position.distanceTo(nearest.entity.position);
    if (d <= 25) {
      sharedState.target = nearest.username;
      sharedState.lastSeen = Date.now();
    }
  }

  // ---- Combat helpers ----
  function engageMelee(targetEntity) {
    try {
      bot.setControlState('sprint', true);
      bot.pvp.attack(targetEntity);
      setTimeout(() => bot.setControlState('sprint', false), 800 + Math.random() * 400);
    } catch {}
  }

  function flankAndApproach(targetEntity) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 4;
    const tx = targetEntity.position.x + Math.cos(angle) * radius;
    const tz = targetEntity.position.z + Math.sin(angle) * radius;
    const ty = targetEntity.position.y;
    bot.pathfinder.setGoal(new goals.GoalNear(tx, ty, tz, 1.2));
  }

  // ---- Wander ----
  function wander() {
    const x = bot.entity.position.x + (Math.random() * 40 - 20);
    const z = bot.entity.position.z + (Math.random() * 40 - 20);
    const y = bot.entity.position.y;
    bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 1.0));
  }

  // ---- Equip best gear ----
  async function equipBestGear() {
    try {
      const preferWeapons = ['diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword'];
      for (const name of preferWeapons) {
        const item = bot.inventory.items().find(i => i.name === name);
        if (item) { await bot.equip(item, 'hand'); break; }
      }

      const armorSlots = [
        { name: 'diamond_boots', slot: 'feet' },
        { name: 'diamond_leggings', slot: 'legs' },
        { name: 'diamond_chestplate', slot: 'torso' },
        { name: 'diamond_helmet', slot: 'head' }
      ];
      for (const a of armorSlots) {
        const item = bot.inventory.items().find(i => i.name === a.name);
        if (item) await bot.equip(item, a.slot);
      }
    } catch {}
  }

  // ---- Event handlers ----
  bot.on('kicked', reason => console.log(`[${username}] Kicked: ${JSON.stringify(reason)}`));
  bot.on('error', err => console.log(`[${username}] Error: ${err?.message || err}`));
  bot.on('end', () => {
    console.log(`[${username}] Disconnected`);
    const idx = sharedState.bots.findIndex(b => b.username === username);
    if (idx !== -1) sharedState.bots[idx].botRef = null;

    if (attempt <= 3) {
      const retryDelay = Math.floor(Math.random() * 30000) + 20000 * attempt;
      console.log(`[Spawner] Retry bot ${username} in ${Math.round(retryDelay/1000)}s (attempt ${attempt})`);
      setTimeout(() => createBot(username, host, port, sharedState, onFinalEnd, attempt + 1), retryDelay);
    } else {
      onFinalEnd();
    }
  });

  // ---- On spawn ----
  bot.once('spawn', async () => {
    try {
      const mcData = mcDataLib(bot.version);
      const movements = new Movements(bot, mcData);
      bot.pathfinder.setMovements(movements);

      sharedState.bots.find(b => b.username === username).botRef = bot;

      console.log(`[${username}] Spawned and online.`);

      await equipBestGear();
      setTimeout(startAILoops, 1200);
    } catch (e) {
      console.log(`[${username}] spawn error: ${e?.message || e}`);
    }
  });

  return bot;
}

module.exports = createBot;
