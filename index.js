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

/* ================= CONFIG – FYLL I ================= */
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,

  WELCOME_CHANNEL_ID: "1452047332278538373",
  TICKET_PANEL_CHANNEL_ID: "1452057166721581216",
  TICKET_CATEGORY_ID: "1452057139618119821",

  SERVICES_CHANNEL_ID: "1452262876155871232",
  PRICES_CHANNEL_ID: "1452262991847227522",
  VOUCH_CHANNEL_ID: "1452263084646338582",
  SALES_CHANNEL_ID: "1452285768742600755",
  ANNOUNCEMENT_CHANNEL_ID: "1452389624801525992",

  STAFF_ROLE_ID: "1452057264155267242",
  MEMBER_ROLE_ID: "1452050878839394355",
  CUSTOMER_ROLE_ID: "1452263553234108548",

  SWISH: "0736816921",
  LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr",

  DISCORD_INVITE: "https://discord.gg/hNRyB2Mewv"
};

/* ================= PRODUKTER ================= */
const PRODUCTS = {
  "🎵 Spotify Premium": {
    "1 Månad": "19 kr",
    "3 Månader": "39 kr",
    "6 Månader": "59 kr",
    "12 Månader": "89 kr"
  },
  "🎬 Netflix 4K UHD Premium": {
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
  "🛡️ Malwarebytes Premium": {
    "12 Månader": "69 kr"
  }
};

/* ================= STATE ================= */
const tickets = new Map();
const cooldown = new Set();

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot online som ${client.user.tag}`);

  const panel = await client.channels.fetch(CONFIG.TICKET_PANEL_CHANNEL_ID);
  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎟 Svenska Streams – Tickets")
        .setDescription(
          "🛒 **Köp konton**\n" +
          "🤝 **Samarbete**\n" +
          "❓ **Frågor / support**\n\n" +
          "Alla ärenden hanteras privat."
        )
        .setColor("Purple")
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_buy").setLabel("🛒 Köp").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_partner").setLabel("🤝 Samarbete").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticket_question").setLabel("❓ Frågor").setStyle(ButtonStyle.Secondary)
      )
    ]
  });
});

/* ================= WELCOME + AUTOROLE ================= */
client.on(Events.GuildMemberAdd, async member => {
  const role = member.guild.roles.cache.get(CONFIG.MEMBER_ROLE_ID);
  if (role) await member.roles.add(role);

  const ch = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
  if (!ch) return;

  ch.send(
    `👋 Välkommen **${member.user.username}**!\n\n` +
    `🛒 Tjänster → <#${CONFIG.SERVICES_CHANNEL_ID}>\n` +
    `💰 Priser → <#${CONFIG.PRICES_CHANNEL_ID}>\n` +
    `🎟 Köp → <#${CONFIG.TICKET_PANEL_CHANNEL_ID}>`
  );
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

  /* ===== Anti-spam ===== */
  if (interaction.isButton()) {
    if (cooldown.has(interaction.user.id)) {
      return interaction.reply({ content: "⏳ Vänta lite.", ephemeral: true });
    }
    cooldown.add(interaction.user.id);
    setTimeout(() => cooldown.delete(interaction.user.id), 2500);
  }

  /* ================= CREATE TICKET ================= */
  if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
    await interaction.deferReply({ ephemeral: true });

    const type =
      interaction.customId === "ticket_buy"
        ? "köp"
        : interaction.customId === "ticket_partner"
        ? "samarbete"
        : "frågor";

    const channel = await interaction.guild.channels.create({
      name: `ticket-${type}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: CONFIG.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    tickets.set(channel.id, { userId: interaction.user.id, type });

    /* ===== KÖP ===== */
    if (type === "köp") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_product")
        .setPlaceholder("Välj produkt")
        .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

      await channel.send({
        embeds: [new EmbedBuilder().setTitle("🛒 Välj produkt").setColor("Blue")],
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* ===== SAMARBETE ===== */
    if (type === "samarbete") {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🤝 Samarbetsförfrågan – Svenska Streams")
            .setDescription(
              "Skicka:\n\n" +
              "• Din Discord-annons\n" +
              "• Antal medlemmar\n" +
              "• Vad du föreslår (annons/shoutout)\n\n" +
              "Staff granskar och godkänner eller nekar."
            )
            .setColor("Orange")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("partner_approve").setLabel("✅ Godkänn").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("partner_deny").setLabel("❌ Neka").setStyle(ButtonStyle.Danger)
          )
        ]
      });
    }

    /* ===== FRÅGOR ===== */
    if (type === "frågor") {
      await channel.send("❓ Skriv ditt ärende. När det är löst kan ticketen stängas.");
    }

    return interaction.editReply({ content: `🎟 Ticket skapad: ${channel}` });
  }

  /* ================= BUY FLOW ================= */
  if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
    const t = tickets.get(interaction.channel.id);
    if (!t || interaction.user.id !== t.userId) return;

    t.product = interaction.values[0];

    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_duration")
      .setPlaceholder("Välj period")
      .addOptions(
        Object.entries(PRODUCTS[t.product]).map(([d, p]) => ({
          label: `${d} – ${p}`,
          value: `${d}|${p}`
        }))
      );

    return interaction.update({ components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
    const t = tickets.get(interaction.channel.id);
    if (!t || interaction.user.id !== t.userId) return;

    const [duration, price] = interaction.values[0].split("|");
    Object.assign(t, { duration, price });

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("🧾 Orderöversikt")
          .setDescription(`Produkt: **${t.product}**\nPeriod: **${duration}**\nPris: **${price}**`)
          .setColor("Green")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("approve_order").setLabel("✅ Godkänn order").setStyle(ButtonStyle.Success)
        )
      ]
    });
  }

  /* ===== STAFF GODKÄNN ===== */
  if (interaction.isButton() && interaction.customId === "approve_order") {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) return;

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("💳 Betalning")
          .setDescription(`Swish: **${CONFIG.SWISH}**\n\nLTC:\n\`${CONFIG.LTC}\``)
          .setColor("Purple")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("paid").setLabel("✅ Jag har betalat").setStyle(ButtonStyle.Success)
        )
      ]
    });
  }

  if (interaction.isButton() && interaction.customId === "paid") {
    return interaction.update({
      content: "⏳ Väntar på verifiering...",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("confirm_payment").setLabel("🔎 Bekräfta betalning").setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  if (interaction.isButton() && interaction.customId === "confirm_payment") {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) return;

    const modal = new ModalBuilder().setCustomId("deliver").setTitle("📦 Leverera konto");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("email").setLabel("Email").setStyle(TextInputStyle.Short)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("password").setLabel("Lösenord").setStyle(TextInputStyle.Short))
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "deliver") {
    const t = tickets.get(interaction.channel.id);
    const member = await interaction.guild.members.fetch(t.userId);

    await member.send(
      `🧾 **Orderkvitto**\n\nProdukt: ${t.product}\nPeriod: ${t.duration}\nPris: ${t.price}\n\n📧 ${interaction.fields.getTextInputValue("email")}\n🔑 ${interaction.fields.getTextInputValue("password")}`
    );

    return interaction.reply({
      content: "📨 Konto skickat.\nBekräfta:",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("confirm_working").setLabel("⭐ Kontot funkar").setStyle(ButtonStyle.Success)
        )
      ]
    });
  }

  if (interaction.isButton() && interaction.customId === "confirm_working") {
    const modal = new ModalBuilder().setCustomId("review").setTitle("⭐ Omdöme");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("stars").setLabel("Betyg 1–5").setStyle(TextInputStyle.Short)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("text").setLabel("Kommentar").setStyle(TextInputStyle.Paragraph))
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "review") {
    const t = tickets.get(interaction.channel.id);
    const stars = "⭐".repeat(Math.min(5, Math.max(1, parseInt(interaction.fields.getTextInputValue("stars")))));

    await client.channels.fetch(CONFIG.VOUCH_CHANNEL_ID)
      .then(ch => ch.send(`**${stars}**\n${t.product} – ${t.price}\n${interaction.fields.getTextInputValue("text")}`));

    await client.channels.fetch(CONFIG.SALES_CHANNEL_ID)
      .then(ch => ch.send(`✅ ${t.product} – ${t.price}`));

    const role = interaction.guild.roles.cache.get(CONFIG.CUSTOMER_ROLE_ID);
    if (role) await interaction.member.roles.add(role);

    await interaction.reply("✅ Tack! Ticket stängs om 10 sek.");
    setTimeout(() => interaction.channel.delete(), 10000);
  }

  /* ================= SAMARBETE GODKÄNN / NEKA ================= */
  if (interaction.isButton() && interaction.customId === "partner_approve") {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) return;

    await client.channels.fetch(CONFIG.ANNOUNCEMENT_CHANNEL_ID)
      .then(ch => ch.send(
`🎬 **Svenska Streams**

Billiga premiumkonton med privat leverans.

Spotify • Netflix • HBO • Disney+ • VPN  
➕ Fler konton på väg

👉 ${CONFIG.DISCORD_INVITE}`
      ));

    await interaction.reply("✅ Samarbete godkänt. Ticket stängs om 10 sek.");
    setTimeout(() => interaction.channel.delete(), 10000);
  }

  if (interaction.isButton() && interaction.customId === "partner_deny") {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) return;

    await interaction.reply("❌ Samarbete nekad. Ticket stängs om 10 sek.");
    setTimeout(() => interaction.channel.delete(), 10000);
  }
});

/* ================= LOGIN ================= */
client.login(CONFIG.TOKEN);
