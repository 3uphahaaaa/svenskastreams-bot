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
    PAYPAL_LOGS: "1453066917719048364",
    PARTNER_LOGS: "1452624943543226501",
    VOUCH: "1452263084646338582",
    FINISHED_ORDERS: "1452285768742600755"
  },
  ROLES: {
    SELLER: "1452263273528299673",
    MEMBER: "1452050878839394355",
    CUSTOMER: "1452263553234108548",
    PARTNER_MANAGER: "1452672352344342528"
  },
  PAYMENTS: {
    SWISH: "0736816921",
    LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr",
    PAYPAL: "@3upweru",
    PAYPAL_ME: "https://paypal.me/3upweru"
  }
};

/* ================= PRODUCTS ================= */
const PRODUCTS = {
  "🎧 Spotify Premium": {
    "1 Månad": "19 kr",
    "3 Månader": "39 kr",
    "6 Månader": "59 kr",
    "12 Månader": "89 kr"
  },
  "📺 Netflix 4K UHD": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "📺 HBO Max Premium": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "📺 Disney+ Premium": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "🔐 NordVPN Plus": {
    "12 Månader": "49 kr"
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
          "🛒 Köp digitala premiumkonton\n" +
          "🤝 Partners & samarbeten\n" +
          "⚡ Snabb & trygg leverans via tickets"
        )
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_buy").setLabel("🛒 Köp").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_partner").setLabel("🤝 Partner").setStyle(ButtonStyle.Secondary)
      )
    ]
  });

  console.log(`✅ Inloggad som ${client.user.tag}`);
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
    ]
  });
});

/* ================= SCREENSHOT ================= */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!msg.channel.name?.startsWith("ticket-")) return;
  if (!msg.attachments.size) return;

  if (msg.channel.screenshotReceived) return;
  msg.channel.screenshotReceived = true;

  const img = msg.attachments.first();
  const method = msg.channel.orderData?.paymentMethod || "Okänd";

  const logId =
    method === "PayPal"
      ? CONFIG.CHANNELS.PAYPAL_LOGS
      : CONFIG.CHANNELS.SWISH_LOGS;

  const log = await msg.guild.channels.fetch(logId).catch(() => null);

  if (log) {
    await log.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📸 Betalning mottagen")
          .addFields(
            { name: "👤 Kund", value: `<@${msg.author.id}>`, inline: true },
            { name: "💳 Metod", value: method, inline: true }
          )
          .setImage(img.url)
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });
  }

  await msg.channel.send(`<@&${CONFIG.ROLES.SELLER}>`);

  await msg.channel.send({
    embeds: [
      new EmbedBuilder()
        .setDescription("📸 Screenshot mottagen\n⏳ Väntar på verifiering.")
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("approve_payment")
          .setLabel("✅ Godkänn betalning")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("reject_payment")
          .setLabel("❌ Avvisa")
          .setStyle(ButtonStyle.Danger)
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

    if (type === "partner") {
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🤝 Partner & Samarbeten")
            .setDescription("📄 Skicka in din annons via formuläret.")
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });
      return interaction.editReply(`🤝 Partner-ticket skapad: ${ch}`);
    }

    await ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🛒 Köp konto")
          .setDescription("Välj produkt")
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

    interaction.editReply(`🎟 Ticket skapad: ${ch}`);
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

    interaction.channel.orderData = {
      product,
      duration,
      price,
      orderId: orderId()
    };

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("💳 Betalning")
          .setDescription(
            `🧾 Order: **${interaction.channel.orderData.orderId}**\n\n` +
            `${product}\n${duration}\n💰 ${price}`
          )
          .setColor(CONFIG.BRAND.COLOR)
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("pay_swish").setLabel("📱 Swish").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("pay_ltc").setLabel("₿ LTC").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("pay_paypal").setLabel("🅿️ PayPal").setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  /* ===== PAY METHODS ===== */
  if (interaction.isButton() && interaction.customId.startsWith("pay_")) {
    const d = interaction.channel.orderData;
    let method = "Okänd";
    let text = "";

    if (interaction.customId === "pay_swish") {
      method = "Swish";
      text = `Swish till **${CONFIG.PAYMENTS.SWISH}**`;
    }
    if (interaction.customId === "pay_ltc") {
      method = "LTC";
      text = `Adress:\n\`${CONFIG.PAYMENTS.LTC}\``;
    }
    if (interaction.customId === "pay_paypal") {
      method = "PayPal";
      text =
        `PayPal: **${CONFIG.PAYMENTS.PAYPAL}**\n` +
        `${CONFIG.PAYMENTS.PAYPAL_ME}\n\n` +
        `📱 QR:\nhttps://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${CONFIG.PAYMENTS.PAYPAL_ME}`;
    }

    interaction.channel.orderData.paymentMethod = method;

    await interaction.channel.setTopic(
      `Order: ${d.orderId} | ${d.product} | ${d.price} | Betalning: ${method}`
    );

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(`💳 ${method}-betalning`)
          .setDescription(
            `🧾 Order: ${d.orderId}\n💰 ${d.price}\n\n${text}\n\n📸 Skicka screenshot på betalningen`
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

    interaction.channel.orderData.seller =
      interaction.member.displayName || interaction.user.username;
    interaction.channel.orderData.sellerId = interaction.member.id;

    const modal = new ModalBuilder()
      .setCustomId("delivery_modal")
      .setTitle("📦 Leverera konto");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("email")
          .setLabel("Email")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("password")
          .setLabel("Lösenord")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* ===== DELIVERY + PDF ===== */
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
          `📦 **Leverans klar**\n\n` +
          `Produkt: ${d.product}\n` +
          `Period: ${d.duration}\n` +
          `Pris: ${d.price}\n` +
          `Betalning: ${d.paymentMethod}\n\n` +
          `🙏 Tack för ditt köp hos Svenska Streams!`,
        files: [new AttachmentBuilder(pdf, { name: `kvitto-${d.orderId}.pdf` })]
      });
    });

    doc.fontSize(18).text("Svenska Streams – Kvitto", { align: "center" });
    doc.moveDown();
    doc.text(`Order: ${d.orderId}`);
    doc.text(`Produkt: ${d.product}`);
    doc.text(`Period: ${d.duration}`);
    doc.text(`Pris: ${d.price}`);
    doc.text(`Betalning: ${d.paymentMethod}`);
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

    return interaction.reply({ ephemeral: true, content: "📦 Leverans skickad." });
  }

  /* ===== CONFIRM WORKING (NYTT) ===== */
  if (interaction.isButton() && interaction.customId === "confirm_working") {
    const d = interaction.channel.orderData;

    const finished = await interaction.guild.channels.fetch(
      CONFIG.CHANNELS.FINISHED_ORDERS
    );

    await finished.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Order Completed – Svenska Streams")
          .setDescription(
            `🛍 **Shop:** Svenska Streams\n\n` +
            `👤 **Köpare:** <@${interaction.user.id}>\n` +
            `📦 **Produkt:** ${d.product}\n` +
            `⏳ **Period:** ${d.duration}\n` +
            `💰 **Pris:** ${d.price}\n` +
            `💳 **Betalning:** ${d.paymentMethod}\n` +
            `🧑‍💼 **Säljare:** ${d.sellerId ? `<@${d.sellerId}>` : "Svenska Streams"}`
          )
          .setColor(CONFIG.BRAND.COLOR)
          .setTimestamp()
      ]
    });

    const modal = new ModalBuilder()
      .setCustomId("review_modal")
      .setTitle("💜 Lämna ett omdöme");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("stars")
          .setLabel("Betyg (1–5 ⭐)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("review")
          .setLabel("Omdöme")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* ===== REVIEW SUBMIT ===== */
  if (interaction.isModalSubmit() && interaction.customId === "review_modal") {
    const d = interaction.channel.orderData;
    const stars = Math.max(1, Math.min(5, parseInt(interaction.fields.getTextInputValue("stars"))));
    const review = interaction.fields.getTextInputValue("review");

    const vouch = await interaction.guild.channels.fetch(CONFIG.CHANNELS.VOUCH);
    await vouch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🛡 Trusted Seller – Order Completed")
          .setDescription("⭐".repeat(stars) + `\n\n"${review}"`)
          .addFields(
            { name: "🛒 Produkt", value: d.product, inline: true },
            { name: "💰 Pris", value: d.price, inline: true },
            { name: "👤 Kund", value: `<@${interaction.user.id}>`, inline: true },
            {
              name: "🧑‍💼 Säljare",
              value: d.sellerId ? `<@${d.sellerId}>` : d.seller || "Svenska Streams",
              inline: true
            }
          )
          .setColor(CONFIG.BRAND.COLOR)
          .setTimestamp()
      ]
    });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const role = await interaction.guild.roles.fetch(CONFIG.ROLES.CUSTOMER);
    if (role) await member.roles.add(role);

    await interaction.reply({ ephemeral: true, content: "🙏 Tack för ditt omdöme!" });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
  }

});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
