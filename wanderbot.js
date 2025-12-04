const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

function createBot(username, host, port) {
  const bot = mineflayer.createBot({
    host,
    port,
    username
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    console.log(`[${username}] Spawned and exploring...`);
    wanderRandomly();
  });

  function wanderRandomly() {
    if (!bot.entity) return;

    const offsetX = Math.floor(Math.random() * 80 - 40);
    const offsetZ = Math.floor(Math.random() * 80 - 40);

    const goal = bot.entity.position.offset(offsetX, 0, offsetZ);

    console.log(`[${username}] Walking to: ${goal}`);

    bot.pathfinder.setGoal(
      new pathfinder.goals.GoalBlock(goal.x, goal.y, goal.z)
    );

    setTimeout(wanderRandomly, 8000 + Math.random() * 8000);
  }

  setInterval(() => {
    const yaw = Math.random() * Math.PI * 2;
    const pitch = Math.random() * 0.6 - 0.3;
    bot.look(yaw, pitch, true);
  }, 4000 + Math.random() * 5000);
}

module.exports = createBot;
