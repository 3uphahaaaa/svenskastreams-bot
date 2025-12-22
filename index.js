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
  TextInputStyle,
  AttachmentBuilder
} = require("discord.js");
const PDFDocument = require("pdfkit");

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= CONFIG ================= */
const CONFIG = {
  BRAND: { NAME: "Svenska Streams", COLOR: "#7b3fe4" },
  CHANNELS: {
    PANEL: "1452057166721581216",
    WELCOME: "1452047332278538373",
    BUY_CATEGORY: "1452706749340586025",
    PARTNER_CATEGORY: "1452706558226989089",
    SWISH_LOGS: "1452671397871489175",
    PARTNER_LOGS: "1452624943543226501",
    VOUCH: "1452263084646338582",
    ANNOUNCEMENTS: "1452389624801525992"
  },
  ROLES: {
    SELLER: "1452263273528299673",
    MEMBER: "1452050878839394355",
    CUSTOMER: "1452263553234108548",
    PARTNER_MANAGER: "1452672352344342528"
  },
  PAYMENTS: {
    SWISH: "0736816921",
    LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
  }
};

/* ================= PRODUCTS ================= */
const PRODUCTS = {
  "🎵 Spotify Premium": {
    "1 Månad": "19 kr",
    "3 Månader": "39 kr",
    "6 Månader": "59 kr",
    "12 Månader": "89 kr"
  },
  "🎬 Netflix 4K Premium": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "📺 HBO Max Premium": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "🍿 Disney+ Premium": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "🔐 NordVPN Plus": {
    "12 Månader": "49 kr"
  },
  "🛡 Malwarebytes Premium": {
    "12 Månader": "69 kr"
  }
};

const orderId = () => `SS-${Math.floor(100000 + Math.random() * 900000)}`;

/* ================= READY – PANEL RESET ================= */
client.once(Events.ClientReady, async () => {
  const panel = await client.channels.fetch(CONFIG.CHANNELS.PANEL);
  const msgs = await panel.messages.fetch({ limit: 50 });
  msgs.filter(m => m.author.id === client.user.id).forEach(m => m.delete().catch(() => {}));

  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🛡 ${CONFIG.BRAND.NAME}`)
        .setDescription(
          "**Trusted Seller System**\n\n" +
          "🛒 Köp digitala konton\n" +
          "🤝 Partners & samarbeten\n" +
          "⚡ Snabb & trygg leverans"
        )
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_buy").setLabel("🛒 Köp konto").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_partner").setLabel("🤝 Partner").setStyle(ButtonStyle.Secondary)
      )
    ]
  });

  console.log("✅ Bot redo");
});

/* ================= AUTOROLE + WELCOME ================= */
client.on(Events.GuildMemberAdd, async member => {
  try {
    const role = await member.guild.roles.fetch(CONFIG.ROLES.MEMBER);
    if (role) await member.roles.add(role);
  } catch {}

  const ch = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
  if (!ch) return;

  ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("👋 Välkommen till Svenska Streams!")
        .setDescription(
          `Hej **${member.user.username}**!\n\n` +
          `🛒 Köp konton via tickets\n` +
          `🤝 Samarbete & partners\n\n` +
          `🎟 Skapa ticket i <#${CONFIG.CHANNELS.PANEL}>`
        )
        .setColor(CONFIG.BRAND.COLOR)
        .setThumbnail(member.user.displayAvatarURL())
    ]
  });
});


/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {

  /* ================= CREATE TICKET ================= */
  if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
    await interaction.deferReply({ ephemeral: true });
    const type = interaction.customId.split("_")[1];

    const ch = await interaction.guild.channels.create({
      name: `ticket-${type}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: type === "partner" ? CONFIG.CHANNELS.PARTNER_CATEGORY : CONFIG.CHANNELS.BUY_CATEGORY,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: CONFIG.ROLES.PARTNER_MANAGER, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    /* ===== PARTNER TICKET ===== */
    if (type === "partner") {
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🤝 Partner & Samarbeten")
            .setDescription(
              "📄 Skicka in din annons / förfrågan via formuläret.\n\n" +
              "🕒 **Status:** Väntar på granskning av partneransvarig."
            )
            .setColor(CONFIG.BRAND.COLOR)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("open_partner_form")
              .setLabel("📄 Skicka annons")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("partner_accept")
              .setLabel("✅ Godkänn partner")
              .setStyle(ButtonStyle.Success)
          )
        ]
      });

      return interaction.editReply(`🤝 Partner-ticket skapad: ${ch}`);
    }

    /* ===== BUY FLOW ===== */
    await ch.send({
      embeds: [new EmbedBuilder().setTitle("🛒 Välj produkt").setColor(CONFIG.BRAND.COLOR)],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select_product")
            .setPlaceholder("Välj produkt")
            .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })))
        )
      ]
    });

    return interaction.editReply(`🎟 Ticket skapad: ${ch}`);
  }

  /* ================= OPEN PARTNER FORM ================= */
  if (interaction.isButton() && interaction.customId === "open_partner_form") {
    const modal = new ModalBuilder()
      .setCustomId("partner_form_v3")
      .setTitle("🤝 Partneransökan");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("server").setLabel("Server / Företag").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("members").setLabel("Antal medlemmar").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("offer").setLabel("Erbjudande").setStyle(TextInputStyle.Paragraph)
      )
    );

    return interaction.showModal(modal);
  }

  /* ================= PARTNER FORM SUBMIT ================= */
  if (interaction.isModalSubmit() && interaction.customId === "partner_form_v3") {
    const log = await interaction.guild.channels.fetch(CONFIG.CHANNELS.PARTNER_LOGS);

    await log.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📄 Ny partneransökan")
          .addFields(
            { name: "Server", value: interaction.fields.getTextInputValue("server") },
            { name: "Medlemmar", value: interaction.fields.getTextInputValue("members") },
            { name: "Erbjudande", value: interaction.fields.getTextInputValue("offer") }
          )
          .setColor(CONFIG.BRAND.COLOR)
          .setTimestamp()
      ]
    });

    return interaction.reply({
      ephemeral: true,
      content: "🙏 Tack! Din partneransökan är skickad. Väntar på granskning."
    });
  }

  /* ================= PARTNER ACCEPT ================= */
  if (interaction.isButton() && interaction.customId === "partner_accept") {
    if (!interaction.member.roles.cache.has(CONFIG.ROLES.PARTNER_MANAGER)) {
      return interaction.reply({ ephemeral: true, content: "❌ Endast partneransvarig." });
    }

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Partner godkänd")
          .setDescription(
            "📢 Skicka nu er annons i er server.\n" +
            "📸 Skicka bildbevis här i ticketen."
          )
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });

    return interaction.reply({ ephemeral: true, content: "Partner godkänd." });
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
