const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_TOKEN;
const WELCOME_CHANNEL_ID = "1452047332278538373";
const AUTO_ROLE_ID = "1452050878839394355";
const TICKET_CATEGORY_ID = "1452057139618119821";
const ADMIN_ROLE_ID = "1452057264155267242";

// 🔽 Ticketpanel-kanalen (din)
const TICKET_PANEL_CHANNEL_ID = "1452057166721581216";

const SWISH_NUMBER = "0736816921";
// =========================================

// ===== BOT READY =====
client.once(Events.ClientReady, async () => {
  console.log(`Bot online som ${client.user.tag}`);
  console.log("Ticketpanel kanal:", TICKET_PANEL_CHANNEL_ID);

  let panelChannel;
  try {
    panelChannel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);
  } catch {
    console.log("❌ Kunde inte hitta ticketpanel-kanalen.");
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_kop")
      .setLabel("🛒 Köp")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("ticket_samarbete")
      .setLabel("🤝 Samarbete")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("ticket_fraqor")
      .setLabel("❓ Frågor")
      .setStyle(ButtonStyle.Secondary)
  );

  await panelChannel.send({
    content:
      "**🎟️ Skapa ticket**\n\n" +
      "Välj vad ditt ärende gäller så hjälper vi dig vidare.",
    components: [row]
  });
});

// ===== AUTOROLE + WELCOME =====
client.on(Events.GuildMemberAdd, async member => {
  try {
    const role = member.guild.roles.cache.get(AUTO_ROLE_ID);
    if (role) await member.roles.add(role);

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    channel.send(
      `Hej **${member.user.username}** 👋\n\n` +
      `Välkommen till **SvenskaStreams**.\n` +
      `🎟️ Öppna en ticket om du behöver hjälp.`
    );
  } catch (err) {
    console.error(err);
  }
});

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async interaction => {

  // ===== SLASH COMMANDS =====
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "3upswish") {
      return interaction.reply({
        content: `💳 **Swish:** ${SWISH_NUMBER}`,
        ephemeral: true
      });
    }

    if (interaction.commandName === "force-close") {
      if (!interaction.channel.name.startsWith("ticket-")) {
        return interaction.reply({ content: "❌ Endast i tickets.", ephemeral: true });
      }

      if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return interaction.reply({ content: "❌ Ingen behörighet.", ephemeral: true });
      }

      await interaction.reply("🔒 Ticket tvångsstängs...");
      return setTimeout(() => interaction.channel.delete(), 2000);
    }

    if (interaction.commandName === "clear") {
      if (!interaction.channel.name.startsWith("ticket-")) {
        return interaction.reply({ content: "❌ Endast i tickets.", ephemeral: true });
      }

      if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return interaction.reply({ content: "❌ Ingen behörighet.", ephemeral: true });
      }

      const amount = interaction.options.getInteger("antal");
      if (amount < 1 || amount > 100) {
        return interaction.reply({ content: "❌ Välj 1–100.", ephemeral: true });
      }

      await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({
        content: `🧹 Rensade ${amount} meddelanden.`,
        ephemeral: true
      });
    }
  }

  // ===== BUTTONS (EN ENDA HANDLER – VIKTIGT) =====
  if (interaction.isButton()) {

    // ---- STÄNG TICKET ----
    if (interaction.customId === "request_close") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_close")
          .setLabel("✅ Godkänn stängning")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("cancel_close")
          .setLabel("❌ Avbryt")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        content: "Vill du verkligen stänga denna ticket?",
        components: [row]
      });
    }

    if (interaction.customId === "confirm_close") {
      await interaction.reply("🔒 Ticket stängs...");
      return setTimeout(() => interaction.channel.delete(), 2000);
    }

    if (interaction.customId === "cancel_close") {
      return interaction.reply({ content: "❌ Avbrutet.", ephemeral: true });
    }

    // ---- SKAPA TICKET ----
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const user = interaction.user;

    let type = "";
    let text = "";

    if (interaction.customId === "ticket_kop") {
      type = "köp";
      text = "🛒 **Köp-ticket**\n\nSkriv vad du vill köpa.";
    }

    if (interaction.customId === "ticket_samarbete") {
      type = "samarbete";
      text = "🤝 **Samarbete-ticket**\n\nBeskriv samarbetet.";
    }

    if (interaction.customId === "ticket_fraqor") {
      type = "frågor";
      text = "❓ **Frågor-ticket**\n\nStäll din fråga.";
    }

    if (!type) {
      return interaction.editReply({ content: "❌ Ogiltigt val." });
    }

    const ticketChannel = await guild.channels.create({
      name: `ticket-${type}-${user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("request_close")
        .setLabel("🔒 Stäng ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send(`Hej **${user.username}** 👋\n\n${text}`);
    await ticketChannel.send({
      content: "När ärendet är klart kan ticketen stängas här:",
      components: [closeRow]
    });

    return interaction.editReply({
      content: `🎟️ Din **${type}-ticket** är skapad: ${ticketChannel}`
    });
  }
});

client.login(TOKEN);
