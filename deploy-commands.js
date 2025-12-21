require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("swish")
    .setDescription("Visa Swish-nummer"),

  new SlashCommandBuilder()
    .setName("ltc")
    .setDescription("Visa Litecoin-adress"),

  new SlashCommandBuilder()
    .setName("vouch")
    .setDescription("Lämna ett omdöme")
    .addIntegerOption(o =>
      o.setName("betyg")
        .setDescription("Betyg 1–5")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("text")
        .setDescription("Ditt omdöme")
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Deploying slash commands...");
    await rest.put(
      Routes.applicationCommands("DIN_BOT_APPLICATION_ID"),
      { body: commands }
    );
    console.log("✅ Slash commands deployed!");
  } catch (err) {
    console.error(err);
  }
})();
