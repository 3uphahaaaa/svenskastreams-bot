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
    VOUCH: "1452263084646338582"
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

/* ================= SCREENSHOT HANDLER ================= */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!msg.channel.name?.startsWith("ticket-")) return;
  if (!msg.attachments.size) return;

  const img = msg.attachments.first();
  const log = await msg.guild.channels.fetch(CONFIG.CHANNELS.SWISH_LOGS).catch(() => null);

  if (log) {
    await log.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📸 Screenshot mottagen")
          .setImage(img.url)
          .setColor(CONFIG.BRAND.COLOR)
          .setTimestamp()
      ]
    });
  }

  await msg.channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("📸 Screenshot mottagen")
        .setDescription("🔍 Väntar på verifiering av personal.")
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("approve_payment")
          .setLabel("⏳ Väntar på verifiering")
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  });
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== CREATE TICKET ===== */
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
        { id: CONFIG.ROLES.SELLER, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: CONFIG.ROLES.PARTNER_MANAGER, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    /* PARTNER */
    if (type === "partner") {
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🤝 Partner & Samarbeten")
            .setDescription(
              "📄 Skicka in din annons via formuläret.\n" +
              "🕒 **Status:** Väntar på granskning."
            )
            .setColor(CONFIG.BRAND.COLOR)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("open_partner_form").setLabel("📄 Skicka annons").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("partner_accept").setLabel("✅ Godkänn").setStyle(ButtonStyle.Success)
          )
        ]
      });

      return interaction.editReply(`🤝 Partner-ticket skapad: ${ch}`);
    }

    /* BUY */
    await ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🛒 Köp konto")
          .setDescription("Välj produkt nedan")
          .setColor(CONFIG.BRAND.COLOR)
      ],
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

  /* ===== SELECT PRODUCT ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
    const product = interaction.values[0];

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(product)
          .setDescription("Välj period")
          .setColor(CONFIG.BRAND.COLOR)
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select_duration")
            .setPlaceholder("Välj period")
            .addOptions(
              Object.entries(PRODUCTS[product]).map(([d, p]) => ({
                label: `${d} – ${p}`,
                value: `${product}|${d}|${p}`
              }))
            )
        )
      ]
    });
  }

  /* ===== SELECT DURATION ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
    const [product, duration, price] = interaction.values[0].split("|");
    const oid = orderId();
    interaction.channel.orderData = { product, duration, price, orderId: oid };

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("💳 Betalning")
          .setDescription(
            `🧾 **Order:** ${oid}\n\n` +
            `${product}\n${duration}\n💰 ${price}`
          )
          .setColor(CONFIG.BRAND.COLOR)
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("pay_swish").setLabel("📱 Swish").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("pay_ltc").setLabel("₿ LTC").setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  /* ===== PAY ===== */
  if (interaction.isButton() && interaction.customId === "pay_swish") {
    const d = interaction.channel.orderData;
    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("📱 Swish-betalning")
          .setDescription(
            `🧾 Order: ${d.orderId}\n` +
            `💰 Summa: ${d.price}\n\n` +
            `Swish till **${CONFIG.PAYMENTS.SWISH}**\n\n` +
            "📸 Skicka screenshot på betalningen"
          )
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });
  }

  if (interaction.isButton() && interaction.customId === "pay_ltc") {
    const d = interaction.channel.orderData;
    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("₿ Litecoin")
          .setDescription(
            `🧾 Order: ${d.orderId}\n\n` +
            `Adress:\n\`${CONFIG.PAYMENTS.LTC}\`\n\n` +
            "📸 Skicka screenshot på betalningen"
          )
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });
  }

  /* ===== APPROVE PAYMENT ===== */
  if (interaction.isButton() && interaction.customId === "approve_payment") {
    if (!interaction.member.roles.cache.has(CONFIG.ROLES.SELLER)) {
      return interaction.reply({ ephemeral: true, content: "❌ Endast säljare." });
    }

    const modal = new ModalBuilder()
      .setCustomId("delivery_modal")
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

  /* ===== DELIVERY ===== */
  if (interaction.isModalSubmit() && interaction.customId === "delivery_modal") {
    const d = interaction.channel.orderData;
    const user = interaction.channel.members.find(m => !m.user.bot);

    const doc = new PDFDocument();
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdf = Buffer.concat(buffers);
      await user.send({
        content:
          `📦 **Ditt konto är levererat**\n\n` +
          `${d.product}\n${d.duration}\n💰 ${d.price}\n🧾 Order: ${d.orderId}`,
        files: [new AttachmentBuilder(pdf, { name: `kvitto-${d.orderId}.pdf` })]
      });
    });

    doc.fontSize(18).text("Svenska Streams – Kvitto", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Order: ${d.orderId}`);
    doc.text(`Produkt: ${d.product}`);
    doc.text(`Period: ${d.duration}`);
    doc.text(`Pris: ${d.price}`);
    doc.end();

    await interaction.channel.send({
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("confirm_working")
            .setLabel("✅ Kontot fungerar")
            .setStyle(ButtonStyle.Success)
        )
      ]
    });

    return interaction.reply({ ephemeral: true, content: "📦 Leverans klar." });
  }

  /* ===== REVIEW ===== */
  if (interaction.isButton() && interaction.customId === "confirm_working") {
    const modal = new ModalBuilder()
      .setCustomId("review_modal")
      .setTitle("⭐ Lämna omdöme");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("stars").setLabel("Betyg (1–5 ⭐)").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("quick").setLabel("Snabba ord").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("review").setLabel("Din upplevelse").setStyle(TextInputStyle.Paragraph)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "review_modal") {
    const stars = Math.max(1, Math.min(5, parseInt(interaction.fields.getTextInputValue("stars"))));
    const quick = interaction.fields.getTextInputValue("quick");
    const text = interaction.fields.getTextInputValue("review");

    const vouch = await interaction.guild.channels.fetch(CONFIG.CHANNELS.VOUCH);
    await vouch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🛡 Trusted Seller – Order Completed")
          .setDescription(`⭐ ${stars}/5\n${quick}\n"${text}"`)
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const role = await interaction.guild.roles.fetch(CONFIG.ROLES.CUSTOMER);
    if (role) await member.roles.add(role);

    await interaction.reply({ ephemeral: true, content: "🙏 Tack för ditt omdöme!" });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
  }

  /* ===== PARTNER FORM ===== */
  if (interaction.isButton() && interaction.customId === "open_partner_form") {
    const modal = new ModalBuilder()
      .setCustomId("partner_form")
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

  if (interaction.isModalSubmit() && interaction.customId === "partner_form") {
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
      ]
    });

    return interaction.reply({ ephemeral: true, content: "🙏 Partneransökan skickad." });
  }

  if (interaction.isButton() && interaction.customId === "partner_accept") {
    if (!interaction.member.roles.cache.has(CONFIG.ROLES.PARTNER_MANAGER)) {
      return interaction.reply({ ephemeral: true, content: "❌ Endast partneransvarig." });
    }

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Partner godkänd")
          .setDescription("📸 Skicka bildbevis när annonsen är publicerad.")
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });

    return interaction.reply({ ephemeral: true, content: "Partner godkänd." });
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
