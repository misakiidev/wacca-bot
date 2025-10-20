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
    const rawCode = interaction.options.getString("access_code");
    const access_code = rawCode.replace(/\s/g, ""); // remove all whitespace

    if (!/^\d{20}$/.test(access_code)) {
      return interaction.reply({
        content: "Access code must consist of exactly 20 numbers (digits only).",
        flags: MessageFlags.Ephemeral,
      });
    }

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
            db.close();
          }
        );
      }
    );
  },
};
