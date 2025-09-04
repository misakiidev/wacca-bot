const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("login")
    .setDescription("Save your Mythos access code.")
    .addStringOption((option) =>
      option
        .setName("access_code")
        .setDescription("Mythos Access Code")
        .setRequired(true)
    ),

  async execute(interaction) {
    const access_code = interaction.options
      .getString("access_code")
      .replaceAll(" ", "");
    const userId = interaction.user.id;
    const dbPath = "./access_codes.db";
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return interaction.reply({
          content:
            "There was an error saving your access code. Please try again later.",
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    db.run(
      `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, access_code TEXT)`,
      (err) => {
        if (err) {
          console.error("Failed to create table:", err);
          db.close();
          return interaction.reply({
            content:
              "There was an error saving your access code. Please try again later.",
            flags: MessageFlags.Ephemeral,
          });
        }

        db.run(
          `INSERT OR REPLACE INTO users (id, access_code) VALUES (?, ?)`,
          [userId, access_code],
          (err) => {
            if (err) {
              console.error("Failed to save access code:", err);
              db.close();
              return interaction.reply({
                content:
                  "There was an error saving your access code. Please try again later.",
                flags: MessageFlags.Ephemeral,
              });
            }
            interaction.reply({
              content: "Your access code has been saved successfully!",
              flags: MessageFlags.Ephemeral,
            });
            console.log(
              `User ${userId} saved their access code: ${access_code}`
            );
            db.close();
          }
        );
      }
    );
  },
};
