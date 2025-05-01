const { Events, ActivityType } = require("discord.js");
// const fs = require("fs");
// const path = require("path");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    client.user.setPresence({
      activities: [{ name: `WACCA Reverse`, type: ActivityType.Playing }],
      status: "online",
    });
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // const serverList = [];
    // client.guilds.cache.forEach((guild) => {
    //   const serverInfo = {
    //     name: guild.name,
    //     memberCount: guild.memberCount,
    //     members: [],
    //   };
    //   guild.members.fetch().then((members) => {
    //     members.forEach((member) => {
    //       serverInfo.members.push(member.user.tag);
    //     });
    //     serverList.push(serverInfo);
    //     const filePath = path.join(__dirname, "serverInfo.json");
    //     fs.writeFileSync(
    //       filePath,
    //       JSON.stringify(serverList, null, 2),
    //       "utf-8"
    //     );
    //   });
    // });
  },
};
