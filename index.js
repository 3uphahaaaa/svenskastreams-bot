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

/* ================== CLIENT ================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

/* ================== CONFIG ================== */
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,

  WELCOME_CHANNEL_ID: "1452047332278538373",
  TICKET_PANEL_CHANNEL_ID: "1452057166721581216",
  TICKET_CATEGORY_ID: "1452057139618119821",

  STAFF_ROLE_ID: "1452057264155267242",
  MEMBER_ROLE_ID: "1452050878839394355",
  CUSTOMER_ROLE_ID: "1452263553234108548",

  SERVICES_CHANNEL_ID: "1452262876155871232",
  PRICES_CHANNEL_ID: "1452262991847227522",
  VOUCH_CHANNEL_ID: "1452263084646338582",
  SALES_CHANNEL_ID: "1452285768742600755",

  SWISH: "0736816921",
  LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
};

/* ================== PRODUKTER ================== */
const PRODUCTS = {
  "⭐ Spotify Premium (MOST POPULAR)": {
    "1 Month": "19 kr",
    "3 Months": "39 kr",
    "6 Months": "59 kr",
    "12 Months": "89 kr"
  },

  "⭐ Netflix 4K UHD Premium (MOST POPULAR)": {
    "6 Months": "39 kr",
    "12 Months": "59 kr"
  },

  "📺 HBO Max Premium": {
    "6 Months": "39 kr",
    "12 Months": "59 kr"
  },

  "📺 Disney+ Premium": {
    "6 Months": "39 kr",
    "12 Months": "59 kr"
  },

  "🔐 NordVPN Plus": {
    "12 Months": "49 kr"
  }
};


/* ================== STATE ================== */
const tickets = new Map();
const cooldown = new Set();

/* ================== READY ================== */
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot online som ${client.user.tag}`);

  const panel = await client.channels.fetch(CONFIG.TICKET_PANEL_CHANNEL_ID);
  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎟 Svenska Streams – Support & Köp")
        .setDescription(
          "Välj vad ditt ärende gäller:\n\n" +
          "🛒 **Köp** – Köp ett konto\n" +
          "🤝 **Samarbete** – Partnerskap\n" +
          "❓ **Frågor** – Support"
        )
        .setColor("#8e44ad")
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

/* ================== WELCOME + AUTOROLE ================== */
client.on(Events.GuildMemberAdd, async member => {
  try {
    const memberRole = member.guild.roles.cache.get(CONFIG.MEMBER_ROLE_ID);
    if (memberRole) await member.roles.add(memberRole);

    const ch = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
    if (!ch) return;

    ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("👋 Välkommen till Svenska Streams!")
          .setDescription(
            `Hej **${member.user.username}**!\n\n` +
            `🛒 **Tjänster:** <#${CONFIG.SERVICES_CHANNEL_ID}>\n` +
            `💰 **Priser:** <#${CONFIG.PRICES_CHANNEL_ID}>\n` +
            `🎟 **Köp:** <#${CONFIG.TICKET_PANEL_CHANNEL_ID}>`
          )
          .setColor("Green")
      ]
    });
  } catch (e) {
    console.error(e);
  }
});

/* ================== INTERACTIONS ================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

  /* ===== ANTI SPAM ===== */
  if (interaction.isButton()) {
    if (cooldown.has(interaction.user.id)) {
      return interaction.reply({ content: "⏳ Vänta lite.", ephemeral: true });
    }
    cooldown.add(interaction.user.id);
    setTimeout(() => cooldown.delete(interaction.user.id), 3000);
  }

  /* ===== CREATE TICKET ===== */
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

    tickets.set(channel.id, { user: interaction.user });

    if (type === "köp") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_product")
        .setPlaceholder("Välj produkt")
        .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🛒 Ny beställning")
            .setDescription("Välj vad du vill köpa nedan.")
            .setColor("Blue")
        ],
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    } else {
      await channel.send(`👋 Hej **${interaction.user.username}**, skriv ditt ärende.`);
    }

    return interaction.editReply({ content: `🎟 Ticket skapad: ${channel}` });
  }

  /* ===== SELECT PRODUCT ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
    const product = interaction.values[0];
    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_duration")
      .setPlaceholder("Välj period")
      .addOptions(
        Object.entries(PRODUCTS[product]).map(([d, p]) => ({
          label: `${d} – ${p}`,
          value: `${product}|${d}|${p}`
        }))
      );

    tickets.get(interaction.channel.id).product = product;
    return interaction.update({ components: [new ActionRowBuilder().addComponents(menu)] });
  }

  /* ===== SELECT DURATION ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
    const [product, duration, price] = interaction.values[0].split("|");
    const t = tickets.get(interaction.channel.id);
    Object.assign(t, { product, duration, price });

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("🛒 Beställning bekräftad")
          .setDescription(
            `**Produkt:** ${product}\n**Period:** ${duration}\n**Pris:** ${price}`
          )
          .setColor("Orange")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("approve_order").setLabel("✅ Godkänn order").setStyle(ButtonStyle.Success)
        )
      ]
    });
  }

  /* ===== STAFF APPROVE ===== */
  if (interaction.isButton() && interaction.customId === "approve_order") {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
      return interaction.reply({ content: "❌ Endast staff.", ephemeral: true });
    }

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("💳 Betalning")
          .setDescription(`Swish eller Litecoin`)
          .setColor("Green")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("pay_swish").setLabel("Swish").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("pay_ltc").setLabel("LTC").setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  /* ===== PAYMENT ===== */
  if (interaction.isButton() && interaction.customId.startsWith("pay_")) {
    const method = interaction.customId === "pay_swish"
      ? `💳 **Swish:** ${CONFIG.SWISH}`
      : `💎 **LTC:**\n\`${CONFIG.LTC}\``;

    return interaction.update({
      embeds: [new EmbedBuilder().setTitle("💰 Betala").setDescription(method)],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("paid").setLabel("✅ Jag har betalat").setStyle(ButtonStyle.Success)
        )
      ]
    });
  }

  /* ===== CUSTOMER PAID ===== */
  if (interaction.isButton() && interaction.customId === "paid") {
    return interaction.update({
      content: "⏳ Väntar på säljare att verifiera betalning...",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("confirm_payment").setLabel("🔎 Bekräfta betalning").setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  /* ===== STAFF CONFIRM PAYMENT ===== */
  if (interaction.isButton() && interaction.customId === "confirm_payment") {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) return;

    const modal = new ModalBuilder()
      .setCustomId("deliver_account")
      .setTitle("📦 Leverera konto");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("email").setLabel("Email").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("password").setLabel("Lösenord").setStyle(TextInputStyle.Short)
      )
    );

    return interaction.showModal(modal);
  }

  /* ===== DELIVER ACCOUNT ===== */
  if (interaction.isModalSubmit() && interaction.customId === "deliver_account") {
    const t = tickets.get(interaction.channel.id);
    await t.user.send(
      `📦 **Ditt konto**\n\n📧 ${interaction.fields.getTextInputValue("email")}\n🔑 ${interaction.fields.getTextInputValue("password")}`
    );

    return interaction.reply({
      content: "📨 Konto skickat via DM.\nKund bekräfta:",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("confirm_working").setLabel("⭐ Kontot funkar").setStyle(ButtonStyle.Success)
        )
      ]
    });
  }

  /* ===== CONFIRM + REVIEW ===== */
  if (interaction.isButton() && interaction.customId === "confirm_working") {
    const modal = new ModalBuilder().setCustomId("review").setTitle("⭐ Omdöme");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("stars").setLabel("Betyg 1–5").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("text").setLabel("Kommentar").setStyle(TextInputStyle.Paragraph)
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "review") {
    const t = tickets.get(interaction.channel.id);
    const stars = "⭐".repeat(Math.min(5, Math.max(1, parseInt(interaction.fields.getTextInputValue("stars")))));

    await (await client.channels.fetch(CONFIG.VOUCH_CHANNEL_ID)).send(
      `**${stars}**\nProdukt: ${t.product}\nPris: ${t.price}\n${interaction.fields.getTextInputValue("text")}`
    );

    await (await client.channels.fetch(CONFIG.SALES_CHANNEL_ID)).send(
      `📦 **Order klar**\n${t.product} – ${t.price}`
    );

    // 🎖 Ge kund-rollen
    const customerRole = interaction.guild.roles.cache.get(CONFIG.CUSTOMER_ROLE_ID);
    if (customerRole) await interaction.member.roles.add(customerRole);

    await interaction.reply("✅ Tack för ditt omdöme! Ticket stängs om 10 sek.");
    setTimeout(() => interaction.channel.delete(), 10000);
  }
});

/* ================== LOGIN ================== */
client.login(CONFIG.TOKEN);
