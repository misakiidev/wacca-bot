const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("login")
    .setDescription("Save your Kamaitachi account.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Kamaitachi Username")
        .setRequired(true)
    ),

  async execute(interaction) {
    const username = interaction.options.getString("username");
    const userId = interaction.user.id;
    const dbPath = "./usernames.db";
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return interaction.reply({
          content:
            "There was an error saving your username. Please try again later.",
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    db.run(
      `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT)`,
      (err) => {
        if (err) {
          console.error("Failed to create table:", err);
          db.close();
          return interaction.reply({
            content:
              "There was an error saving your username. Please try again later.",
            flags: MessageFlags.Ephemeral,
          });
        }

        db.run(
          `INSERT OR REPLACE INTO users (id, username) VALUES (?, ?)`,
          [userId, username],
          (err) => {
            if (err) {
              console.error("Failed to save username:", err);
              db.close();
              return interaction.reply({
                content:
                  "There was an error saving your username. Please try again later.",
                flags: MessageFlags.Ephemeral,
              });
            }
            interaction.reply({
              content: "Your username has been saved successfully!",
              flags: MessageFlags.Ephemeral,
            });
            db.close();
          }
        );
      }
    );
  },
};
