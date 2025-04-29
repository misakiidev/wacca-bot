const { Events, ActivityType } = require("discord.js");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    client.user.setPresence({
      activities: [{ name: `WACCA Reverse`, type: ActivityType.Playing }],
      status: "online",
    });
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};
