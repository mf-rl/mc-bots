const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const { Vec3 } = require('vec3');
const mcDataLib = require('minecraft-data');

// Filter console output to suppress packet parsing noise
const originalConsoleLog = console.log;
console.log = function(...args) {
  const msg = args.join(' ');
  // Suppress "Chunk size" packet errors - they're harmless network noise
  if (msg.includes('Chunk size') && msg.includes('partial packet')) {
    return;
  }
  originalConsoleLog.apply(console, args);
};

function createBot(username, host, port, sharedState = {}, onFinalEnd = () => {}, attempt = 1) {
  const bot = mineflayer.createBot({
    host,
    port,
    username,
    version: false, // Auto-detect version
    checkTimeoutInterval: 30000, // 30 seconds
    hideErrors: true, // Hide library errors to reduce noise
    keepAlive: true,
    respawn: true,
    logErrors: false // Disable automatic error logging
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  sharedState.bots = sharedState.bots || [];
  sharedState.bots.push({ username, botRef: null });

  // ---- Survival helpers ----
  async function tryAutoEat() {
    try {
      if (!bot.entity || !bot.food || bot.food >= 16) return;
      const food = bot.inventory.items().find(i => 
        /beef|pork|bread|apple|carrot|potato|chicken|mutton|fish|salmon|cookie|melon|berry/.test(i.name)
      );
      if (!food) return;
      await bot.equip(food, 'hand');
      bot.activateItem();
      await bot.waitForTicks(30); // ~1.5 seconds
      bot.deactivateItem();
    } catch (err) {
      console.log(`[${username}] Auto-eat error: ${err?.message || err}`);
    }
  }

  async function craftItem(recipeName, count = 1) {
    try {
      if (!bot.entity) return false;
      const mcData = mcDataLib(bot.version);
      const itemData = mcData.itemsByName[recipeName];
      if (!itemData) {
        console.log(`[${username}] Unknown item: ${recipeName}`);
        return false;
      }
      const recipes = bot.recipesFor(itemData.id, null, 1, null);
      if (recipes.length === 0) return false;
      
      console.log(`[${username}] Starting to craft ${count}x ${recipeName}...`);
      await bot.craft(recipes[0], count);
      console.log(`[${username}] ✓ Completed crafting ${count}x ${recipeName}`);
      return true;
    } catch (err) {
      console.log(`[${username}] Craft error for ${recipeName}: ${err?.message || err}`);
      return false;
    }
  }

  // ---- Advanced crafting ----
  async function ensureTools() {
    try {
      if (!bot.entity) return;
      const mcData = mcDataLib(bot.version);
      
      console.log(`[${username}] Checking tools inventory...`);
      // Priority: diamond > iron > stone > wooden tools
      const toolTypes = ['sword', 'pickaxe', 'axe', 'shovel'];
      const materials = ['diamond', 'iron', 'stone', 'wooden'];
      
      for (const tool of toolTypes) {
        const hasTool = bot.inventory.items().some(i => i.name.includes(tool));
        if (hasTool) continue;
        
        // Try to craft best available tool
        for (const material of materials) {
          const itemName = `${material}_${tool}`;
          if (await craftItem(itemName)) break;
        }
      }
    } catch (err) {
      console.log(`[${username}] ensureTools error: ${err?.message || err}`);
    }
  }

  async function gatherBasicResources() {
    try {
      if (!bot.entity) return;
      
      console.log(`[${username}] Gathering basic resources...`);
      
      // Find and dig nearby logs for wood
      const logBlock = bot.findBlock({
        matching: (block) => block.name.includes('log'),
        maxDistance: 32,
        count: 1
      });
      
      if (logBlock) {
        await bot.pathfinder.goto(new goals.GoalNear(logBlock.position.x, logBlock.position.y, logBlock.position.z, 3));
        await bot.dig(logBlock);
        
        // Craft wood planks from logs
        const logs = bot.inventory.items().find(i => i.name.includes('log'));
        if (logs) {
          await craftItem('oak_planks', Math.min(logs.count * 4, 64));
          await craftItem('stick', 16);
        }
      }
    } catch (err) {
      console.log(`[${username}] Gather resources error: ${err?.message || err}`);
    }
  }

  // ---- Building system ----
  async function buildStructure(centerPos, structureType = 'shelter') {
    try {
      if (!bot.entity) return;
      const mcData = mcDataLib(bot.version);
      
      console.log(`[${username}] Starting to build ${structureType} at ${centerPos}...`);
      
      // Ensure we have building materials
      const buildingBlocks = bot.inventory.items().filter(i => 
        i.name.includes('planks') || i.name.includes('cobblestone') || i.name.includes('dirt')
      );
      
      if (buildingBlocks.length === 0) {
        console.log(`[${username}] No building materials`);
        return;
      }
      
      const material = buildingBlocks[0];
      await bot.equip(material, 'hand');
      
      if (structureType === 'shelter') {
        // Build a simple 5x5x3 shelter
        for (let y = 0; y < 3; y++) {
          for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
              // Only build walls and roof, leave inside hollow
              if (y === 0 || y === 2 || Math.abs(x) === 2 || Math.abs(z) === 2) {
                const targetPos = centerPos.offset(x, y, z);
                const blockAtPos = bot.blockAt(targetPos);
                
                if (blockAtPos && blockAtPos.name === 'air') {
                  // Find reference block to place against
                  const refBlock = bot.blockAt(targetPos.offset(0, -1, 0));
                  if (refBlock && refBlock.name !== 'air') {
                    try {
                      await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
                      await bot.waitForTicks(2);
                    } catch (placeErr) {
                      // Placement failed, continue
                    }
                  }
                }
              }
            }
          }
        }
        console.log(`[${username}] ✓ Completed building shelter at ${centerPos}`);
      } else if (structureType === 'wall') {
        // Build a simple wall
        for (let i = 0; i < 10; i++) {
          for (let y = 0; y < 2; y++) {
            const targetPos = centerPos.offset(i, y, 0);
            const blockAtPos = bot.blockAt(targetPos);
            
            if (blockAtPos && blockAtPos.name === 'air') {
              const refBlock = bot.blockAt(targetPos.offset(0, -1, 0));
              if (refBlock && refBlock.name !== 'air') {
                try {
                  await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
                  await bot.waitForTicks(2);
                } catch {}
              }
            }
          }
        }
        console.log(`[${username}] ✓ Completed building wall at ${centerPos}`);
      }
    } catch (err) {
      console.log(`[${username}] Build error: ${err?.message || err}`);
    }
  }

  // ---- AI loop ----
  let lastToolCheck = 0;
  let lastResourceGather = 0;
  let lastBuildCheck = 0;
  let actionInProgress = false;
  
  function startAILoops() {
    setInterval(async () => {
      if (!bot.entity || actionInProgress) return;

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
        // Survival mode: eat, gather, craft, build
        tryAutoEat();
        
        const now = Date.now();
        
        // Check for tools every 2 minutes
        if (now - lastToolCheck > 120000) {
          actionInProgress = true;
          await ensureTools();
          lastToolCheck = now;
          actionInProgress = false;
        }
        
        // Gather resources every 5 minutes
        if (now - lastResourceGather > 300000) {
          actionInProgress = true;
          await gatherBasicResources();
          lastResourceGather = now;
          actionInProgress = false;
        }
        
        // Build structures occasionally (every 10 minutes)
        if (now - lastBuildCheck > 600000) {
          const hasBlocks = bot.inventory.items().some(i => 
            i.name.includes('planks') || i.name.includes('cobblestone')
          );
          if (hasBlocks && Math.random() < 0.3) {
            actionInProgress = true;
            const buildPos = bot.entity.position.offset(
              Math.floor(Math.random() * 10 - 5),
              0,
              Math.floor(Math.random() * 10 - 5)
            );
            await buildStructure(buildPos, Math.random() < 0.7 ? 'shelter' : 'wall');
            lastBuildCheck = now;
            actionInProgress = false;
          }
        }
        
        // Wander occasionally
        if (Math.random() < 0.05) wander();
      }
    }, 1000);
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
    try {
      if (!bot.entity || !targetEntity) return;
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 4;
      const tx = targetEntity.position.x + Math.cos(angle) * radius;
      const tz = targetEntity.position.z + Math.sin(angle) * radius;
      const ty = targetEntity.position.y;
      bot.pathfinder.setGoal(new goals.GoalNear(tx, ty, tz, 1.2), true);
    } catch (err) {
      console.log(`[${username}] Flank error: ${err?.message || err}`);
    }
  }

  // ---- Wander ----
  function wander() {
    try {
      if (!bot.entity) return;
      const x = bot.entity.position.x + (Math.random() * 40 - 20);
      const z = bot.entity.position.z + (Math.random() * 40 - 20);
      const y = bot.entity.position.y;
      bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 1.0), true);
    } catch (err) {
      console.log(`[${username}] Wander error: ${err?.message || err}`);
    }
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
  let lastKeepAlive = Date.now();
  let packetErrorCount = 0;
  
  bot.on('packet', (data, meta) => {
    if (meta.name === 'keep_alive') {
      lastKeepAlive = Date.now();
      packetErrorCount = 0; // Reset error count on successful keepalive
    }
  });
  
  // Handle packet errors gracefully
  bot._client.on('error', (err) => {
    if (err.message && (err.message.includes('Chunk size') || err.message.includes('partial packet'))) {
      packetErrorCount++;
      
      // Only log every 100th packet error, or when approaching threshold
      if (packetErrorCount % 100 === 0 || packetErrorCount > 40) {
        console.log(`[${username}] Packet errors: ${packetErrorCount} (will reconnect at 50)`);
      }
      
      // If too many packet errors, reconnect
      if (packetErrorCount > 50) {
        console.log(`[${username}] Too many packet errors, reconnecting...`);
        bot.end('packet_errors');
      }
    } else {
      console.log(`[${username}] Client error: ${err?.message || err}`);
    }
  });
  
  // Monitor for timeout and packet errors
  const timeoutChecker = setInterval(() => {
    if (!bot || !bot._client) {
      clearInterval(timeoutChecker);
      return;
    }
    
    const timeSinceKeepalive = Date.now() - lastKeepAlive;
    
    // Only warn if connection is genuinely slow
    if (bot.entity && timeSinceKeepalive > 50000 && timeSinceKeepalive < 60000) {
      console.log(`[${username}] Connection slow (${Math.round(timeSinceKeepalive/1000)}s since keepalive)`);
    }
    
    // Timeout if no keepalive for too long
    if (bot.entity && timeSinceKeepalive > 60000) {
      console.log(`[${username}] Keep-alive timeout (${Math.round(timeSinceKeepalive/1000)}s), reconnecting...`);
      clearInterval(timeoutChecker);
      bot.end('timeout');
    }
    
    // Gradually reduce packet error counter if connection is healthy
    if (timeSinceKeepalive < 20000 && packetErrorCount > 0) {
      packetErrorCount = Math.max(0, packetErrorCount - 5);
    }
  }, 15000); // Check every 15 seconds instead of 10
  
  bot.on('kicked', reason => {
    console.log(`[${username}] Kicked: ${JSON.stringify(reason)}`);
    clearInterval(timeoutChecker);
  });
  
  bot.on('error', err => {
    const errMsg = err?.message || err?.toString() || 'Unknown error';
    
    // Ignore packet parsing errors (handled by client error handler)
    if (errMsg.includes('Chunk size') || errMsg.includes('partial packet')) {
      return; // Don't log these, they're handled elsewhere
    }
    
    console.log(`[${username}] Bot error: ${errMsg}`);
    
    // Fatal connection errors
    if (errMsg.includes('ECONNRESET') || errMsg.includes('ETIMEDOUT') || 
        errMsg.includes('ECONNREFUSED') || errMsg.includes('EHOSTUNREACH')) {
      console.log(`[${username}] Fatal connection error, will retry`);
    }
  });
  
  bot.on('end', () => {
    console.log(`[${username}] Disconnected`);
    clearInterval(timeoutChecker);
    const idx = sharedState.bots.findIndex(b => b.username === username);
    if (idx !== -1) sharedState.bots[idx].botRef = null;

    if (attempt <= 5) {
      // Exponential backoff with jitter: base delay increases with each attempt
      const baseDelay = 15000 * Math.pow(1.5, attempt - 1); // 15s, 22.5s, 33.75s, 50.6s, 75.9s
      const jitter = Math.floor(Math.random() * 10000); // 0-10 seconds random
      const retryDelay = Math.floor(baseDelay + jitter);
      
      console.log(`[${username}] Retry in ${Math.round(retryDelay/1000)}s (attempt ${attempt}/5)`);
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
      movements.allowSprinting = true;
      movements.canDig = false; // Prevent digging during pathfinding to avoid getting stuck
      movements.scaffoldingBlocks = [];
      bot.pathfinder.setMovements(movements);

      sharedState.bots.find(b => b.username === username).botRef = bot;

      console.log(`[${username}] Spawned and online.`);

      await equipBestGear();
      
      // Start AI with a delay to ensure everything is loaded
      setTimeout(startAILoops, 2000);
    } catch (e) {
      console.log(`[${username}] spawn error: ${e?.message || e}`);
    }
  });
  
  // Handle pathfinder errors
  bot.on('goal_reached', () => {
    // Clear any stuck state
  });
  
  bot.on('path_update', (r) => {
    // Path updated successfully
  });
  
  bot.on('goal_updated', () => {
    // Goal was updated
  });

  return bot;
}

module.exports = createBot;
