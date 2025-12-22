require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

/* ================= CONFIG – RÖR BARA DETTA ================= */
const CONFIG = {
  BRAND: {
    NAME: "Svenska Streams",
    COLOR: "Purple",
    INVITE: "https://discord.gg/hNRyB2Mewv"
  },

  CHANNELS: {
    WELCOME: "1452047332278538373",
    TICKET_PANEL: "1452057166721581216",
    TICKET_CATEGORY: "1452057139618119821",
    ANNOUNCEMENTS: "1452389624801525992",
    VOUCH: "1452263084646338582",
    SALES: "1452285768742600755"
  },

  ROLES: {
    STAFF: "1452057264155267242",
    MEMBER: "1452050878839394355",
    CUSTOMER: "1452263553234108548"
  },

  PAYMENTS: {
    SWISH: "0736816921",
    LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
  },

  AUTO: {
    CLOSE_TICKET_AFTER: 10,
    COOLDOWN: 2500
  }
};

/* ================= PRODUKTER ================= */
const PRODUCTS = {
  "🎵 Spotify Premium": { "1 Månad": "19 kr", "3 Månader": "39 kr", "6 Månader": "59 kr", "12 Månader": "89 kr" },
  "🎬 Netflix 4K UHD": { "6 Månader": "39 kr", "12 Månader": "59 kr" },
  "📺 HBO Max": { "6 Månader": "39 kr", "12 Månader": "59 kr" },
  "🍿 Disney+": { "6 Månader": "39 kr", "12 Månader": "59 kr" }
};

/* ================= STATE ================= */
const tickets = new Map();
const cooldown = new Set();

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${CONFIG.BRAND.NAME} online som ${client.user.tag}`);

  const panel = await client.channels.fetch(CONFIG.CHANNELS.TICKET_PANEL);
  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🎟 ${CONFIG.BRAND.NAME} – Tickets`)
        .setDescription("🛒 Köp\n🤝 Samarbete\n❓ Support")
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_buy").setLabel("🛒 Köp").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_partner").setLabel("🤝 Samarbete").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticket_support").setLabel("❓ Support").setStyle(ButtonStyle.Secondary)
      )
    ]
  });
});

/* ================= WELCOME ================= */
client.on(Events.GuildMemberAdd, async member => {
  const role = member.guild.roles.cache.get(CONFIG.ROLES.MEMBER);
  if (role) await member.roles.add(role);

  const ch = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
  if (ch) ch.send(`👋 Välkommen **${member.user.username}** till ${CONFIG.BRAND.NAME}`);
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

  if (interaction.isButton()) {
    if (cooldown.has(interaction.user.id)) return interaction.reply({ content: "⏳ Vänta lite.", ephemeral: true });
    cooldown.add(interaction.user.id);
    setTimeout(() => cooldown.delete(interaction.user.id), CONFIG.AUTO.COOLDOWN);
  }

  /* ================= CREATE TICKET ================= */
  if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
    const existing = [...tickets.values()].find(t => t.userId === interaction.user.id);
    if (existing) return interaction.reply({ content: "❌ Du har redan en ticket.", ephemeral: true });

    const type = interaction.customId.split("_")[1];
    const channel = await interaction.guild.channels.create({
      name: `ticket-${type}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: CONFIG.CHANNELS.TICKET_CATEGORY,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: CONFIG.ROLES.STAFF, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    tickets.set(channel.id, { userId: interaction.user.id, type });

    if (type === "partner") {
      const modal = new ModalBuilder().setCustomId("partner_form").setTitle("🤝 Samarbete");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("invite").setLabel("Deras Discord-invite").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("members").setLabel("Antal medlemmar").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ad").setLabel("Deras annons").setStyle(TextInputStyle.Paragraph))
      );
      await interaction.showModal(modal);
      return;
    }

    if (type === "buy") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_product")
        .setPlaceholder("Välj produkt")
        .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

      await channel.send({ components: [new ActionRowBuilder().addComponents(menu)] });
    }

    await interaction.reply({ content: `🎟 Ticket skapad: ${channel}`, ephemeral: true });
  }

  /* ================= PARTNER FORM ================= */
  if (interaction.isModalSubmit() && interaction.customId === "partner_form") {
    const t = tickets.get(interaction.channel.id);
    t.invite = interaction.fields.getTextInputValue("invite");

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📨 Samarbetsförslag")
          .setDescription(`🔗 ${t.invite}`)
          .setColor("Orange")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("partner_approve").setLabel("✅ Godkänn").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("partner_deny").setLabel("❌ Neka").setStyle(ButtonStyle.Danger)
        )
      ]
    });

    await interaction.reply({ content: "✅ Skickat till staff.", ephemeral: true });
  }

  /* ================= PARTNER APPROVE ================= */
  if (interaction.isButton() && interaction.customId === "partner_approve") {
    if (!interaction.member.roles.cache.has(CONFIG.ROLES.STAFF)) return;

    const t = tickets.get(interaction.channel.id);

    await client.channels.fetch(CONFIG.CHANNELS.ANNOUNCEMENTS)
      .then(ch => ch.send(`🤝 **Nytt samarbete**\n👉 ${t.invite}`));

    const user = await client.users.fetch(t.userId);
    await user.send(
`🎬 **${CONFIG.BRAND.NAME}**
Billiga premiumkonton
👉 ${CONFIG.BRAND.INVITE}`
    );

    await interaction.reply("✅ Klart. Ticket stängs.");
    setTimeout(() => interaction.channel.delete(), CONFIG.AUTO.CLOSE_TICKET_AFTER * 1000);
  }

  if (interaction.isButton() && interaction.customId === "partner_deny") {
    await interaction.reply("❌ Nekad.");
    setTimeout(() => interaction.channel.delete(), CONFIG.AUTO.CLOSE_TICKET_AFTER * 1000);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
