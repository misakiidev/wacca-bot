const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
} = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(
  require("path").resolve(__dirname, "../../access_codes.db")
);

module.exports = {
  data: new SlashCommandBuilder()
    .setContexts(
      InteractionContextType.PrivateChannel,
      InteractionContextType.BotDM,
      InteractionContextType.Guild
    )
    .setName("list")
    .setDescription("List every chart for a certain chart constant.")
    .addStringOption((option) =>
      option
        .setName("level")
        .setDescription("The chart constant to search for.")
        .setRequired(true)
    ),

  async execute(interaction) {
    const { waccaSongs } = require("../../waccaSongs.js");
    const level = interaction.options.getString("level");

    if (!/^\d+(\.\d)?$/.test(level)) {
      return interaction.reply({
        content: "Invalid level format. Use format like: 13, 13.0, or 13.9",
        ephemeral: true,
      });
    }
    const matchingSongs = waccaSongs.filter((song) => {
      return Object.values(song.sheets).some(
        (diff) => diff.difficulty.toString() === level
      );
    });
    if (matchingSongs.length === 0) {
      return interaction.reply({
        content: `No songs found with level ${level}.`,
        ephemeral: true,
      });
    }
    const embed = new EmbedBuilder()
      .setTitle(`Songs with Level ${level}`)
      .setDescription(
        matchingSongs
          .map((song) => {
            const sheet = Object.values(song.sheets).findIndex(
              (diff) => diff.difficulty.toString() === level
            );
            const difficultyNames = {
              1: "Normal",
              2: "Hard",
              3: "Expert",
              4: "Inferno",
            };
            const diffName = difficultyNames[sheet + 1] || "Unknown";
            return `**${song.title}** by ${song.artist} (Difficulty: ${diffName})`;
          })
          .join("\n")
      );
    return interaction.reply({ embeds: [embed] });
  },
};
