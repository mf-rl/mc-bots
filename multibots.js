const createBot = require('./wanderbot');

for (let i = 1; i <= 5; i++) {
  setTimeout(() => {
    createBot(`Bot${i}`, "localhost", 25565);
  }, i * 2000);
}
