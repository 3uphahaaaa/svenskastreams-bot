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
    SELLER: "1452263273528299673"
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

/* ================= READY (PANEL RESET) ================= */
client.once(Events.ClientReady, async () => {
  console.log(`✅ Inloggad som ${client.user.tag}`);

  const panelChannel = await client.channels.fetch(CONFIG.CHANNELS.PANEL);
  if (!panelChannel || !panelChannel.isTextBased()) return;

  // 🧹 Ta bort gamla paneler
  const messages = await panelChannel.messages.fetch({ limit: 25 });
  const botMessages = messages.filter(m => m.author.id === client.user.id);
  for (const m of botMessages.values()) {
    await m.delete().catch(() => {});
  }

  // 🟣 Ny panel
  await panelChannel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`💜 ${CONFIG.BRAND.NAME}`)
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

  console.log("🧹 Panel rensad & ny panel skickad");
});

/* ================= WELCOME (GAMLA) ================= */
client.on(Events.GuildMemberAdd, async member => {
  const ch = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
  if (!ch) return;

  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setColor(CONFIG.BRAND.COLOR)
        .setTitle("👋 Välkommen till Svenska Streams!")
        .setDescription(
          `Hej **${member.user.username}**!\n\n` +
          `🛒 Köp konton via tickets\n` +
          `🤝 Samarbeten & partners\n\n` +
          `🎟 Skapa ticket i <#${CONFIG.CHANNELS.PANEL}>`
        )
        .setThumbnail(member.user.displayAvatarURL())
    ]
  });
});

/* ================= SCREENSHOT ================= */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!msg.attachments.size) return;
  if (!msg.channel.name.startsWith("ticket-")) return;

  const img = msg.attachments.first();
  const isPartner = msg.channel.parentId === CONFIG.CHANNELS.PARTNER_CATEGORY;

  const logChannel = await msg.guild.channels.fetch(
    isPartner ? CONFIG.CHANNELS.PARTNER_LOGS : CONFIG.CHANNELS.SWISH_LOGS
  );

  await logChannel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("📸 Screenshot mottagen")
        .setImage(img.url)
        .addFields(
          { name: "Användare", value: `<@${msg.author.id}>`, inline: true },
          { name: "Ticket", value: msg.channel.name, inline: true }
        )
        .setColor(CONFIG.BRAND.COLOR)
    ]
  });

  if (!isPartner) {
    await msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription("✅ **Betalning mottagen**\n🔍 Verifierar automatiskt…")
          .setColor(CONFIG.BRAND.COLOR)
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("approve_payment")
            .setLabel("🔒 Väntar på verifiering")
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {

  /* CREATE TICKET */
  if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
    await interaction.deferReply({ ephemeral: true });
    const type = interaction.customId.split("_")[1];

    const channel = await interaction.guild.channels.create({
      name: `ticket-${type}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: type === "partner" ? CONFIG.CHANNELS.PARTNER_CATEGORY : CONFIG.CHANNELS.BUY_CATEGORY,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    // 🤝 PARTNER
    if (type === "partner") {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🤝 Partner & Samarbeten")
            .setDescription(
              "Skicka in din **annons / förfrågan** via formuläret nedan.\n\n" +
              "💜 Vänligen vänta – en partneransvarig svarar inom kort."
            )
            .setColor(CONFIG.BRAND.COLOR)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("partner_form").setLabel("📝 Skicka annons").setStyle(ButtonStyle.Primary)
          )
        ]
      });

      return interaction.editReply(`🤝 Partner-ticket skapad: ${channel}`);
    }

    // 🛒 BUY
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("💜 Välkommen!")
          .setDescription("Välj din produkt nedan 🌿")
          .setColor(CONFIG.BRAND.COLOR)
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select_product")
            .setPlaceholder("✨ Välj produkt")
            .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })))
        )
      ]
    });

    return interaction.editReply(`🎟 Ticket skapad: ${channel}`);
  }

  /* PARTNER FORM */
  if (interaction.isButton() && interaction.customId === "partner_form") {
    const modal = new ModalBuilder()
      .setCustomId("partner_modal")
      .setTitle("📝 Partnerannons");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("ad")
          .setLabel("Din annons / samarbetsförslag")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* PARTNER SUBMIT */
  if (interaction.isModalSubmit() && interaction.customId === "partner_modal") {
    const log = await interaction.guild.channels.fetch(CONFIG.CHANNELS.PARTNER_LOGS);

    await log.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🤝 Ny partnerannons")
          .setDescription(interaction.fields.getTextInputValue("ad"))
          .setColor(CONFIG.BRAND.COLOR)
          .setTimestamp()
      ]
    });

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription("💜 Tack! Vänligen vänta – en partneransvarig svarar inom kort.")
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });

    return interaction.reply({ ephemeral: true, content: "✅ Annons skickad!" });
  }

  /* PRODUCT */
  if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
    const product = interaction.values[0];

    return interaction.update({
      embeds: [
        new EmbedBuilder().setTitle(product).setDescription("📅 Välj period").setColor(CONFIG.BRAND.COLOR)
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

  /* DURATION */
  if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
    const [product, duration, price] = interaction.values[0].split("|");
    const orderId = `SS-${Math.floor(100000 + Math.random() * 900000)}`;
    interaction.channel.orderData = { product, duration, price, orderId };

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("💳 Välj betalmetod")
          .setDescription(`🧾 Order: **${orderId}**\n${product}\n${duration}\n💰 ${price}`)
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

  /* SWISH */
  if (interaction.isButton() && interaction.customId === "pay_swish") {
    const d = interaction.channel.orderData;
    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("📱 Swish-betalning")
          .setDescription(
            `🧾 Order: **${d.orderId}**\n💰 ${d.price}\n\n` +
            `📲 Swish till **${CONFIG.PAYMENTS.SWISH}**\n\n` +
            `📡 Status: ⏳ Väntar på betalning`
          )
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });
  }

  /* LTC */
  if (interaction.isButton() && interaction.customId === "pay_ltc") {
    const d = interaction.channel.orderData;
    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("₿ LTC-betalning")
          .setDescription(
            `🧾 Order: **${d.orderId}**\n💰 ${d.price}\n\n` +
            `📥 Adress:\n\`${CONFIG.PAYMENTS.LTC}\`\n\n` +
            `📡 Status: ⏳ Väntar på betalning`
          )
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });
  }

  /* APPROVE PAYMENT */
  if (interaction.isButton() && interaction.customId === "approve_payment") {
    if (
      !interaction.member.roles.cache.has(CONFIG.ROLES.SELLER) &&
      !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return interaction.reply({ content: "❌ Endast säljare.", ephemeral: true });
    }

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription("🤖 **Automatisk verifiering klar**\n💜 Din betalning är godkänd.\n📦 Levererar ditt konto nu…")
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });

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

  /* DELIVERY */
  if (interaction.isModalSubmit() && interaction.customId === "delivery_modal") {
    const customer = interaction.channel.members.find(m => !m.user.bot);
    const d = interaction.channel.orderData;

    await customer.send(
      `📦 **Ditt konto är klart!**\n\n📧 ${interaction.fields.getTextInputValue("email")}\n` +
      `🔑 ${interaction.fields.getTextInputValue("password")}\n\n🧾 Order: **${d.orderId}**`
    );

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder().setDescription("🌿 Kontot skickat! Klicka nedan när allt fungerar.").setColor(CONFIG.BRAND.COLOR)
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("confirm_working").setLabel("✅ Kontot fungerar").setStyle(ButtonStyle.Success)
        )
      ]
    });

    return interaction.reply({ ephemeral: true, content: "📦 Levererat." });
  }

  /* CONFIRM WORKING */
  if (interaction.isButton() && interaction.customId === "confirm_working") {
    const modal = new ModalBuilder().setCustomId("review_modal").setTitle("💜 Lämna ett omdöme");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("review")
          .setLabel("Hur var din upplevelse?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* REVIEW + PDF + CLOSE */
  if (interaction.isModalSubmit() && interaction.customId === "review_modal") {
    const review = interaction.fields.getTextInputValue("review");
    const d = interaction.channel.orderData;

    const vouch = await interaction.guild.channels.fetch(CONFIG.CHANNELS.VOUCH);
    await vouch.send({
      embeds: [new EmbedBuilder().setTitle("⭐ Ny review").setDescription(review).setColor(CONFIG.BRAND.COLOR)]
    });

    const doc = new PDFDocument();
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdf = Buffer.concat(buffers);
      const file = new AttachmentBuilder(pdf, { name: "kvitto.pdf" });
      await interaction.user.send({
        content: `🧾 **Kvitto – Svenska Streams**\nOrder: **${d.orderId}**\nTack för att du handlade hos oss 💜`,
        files: [file]
      });
    });

    doc.fontSize(20).text("Svenska Streams", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Order: ${d.orderId}`);
    doc.text(`Produkt: ${d.product}`);
    doc.text(`Period: ${d.duration}`);
    doc.text(`Pris: ${d.price}`);
    doc.text(`Datum: ${new Date().toLocaleDateString()}`);
    doc.end();

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription("💜 Tack för att du handlade hos oss!\nDenna ticket stängs automatiskt.")
          .setColor(CONFIG.BRAND.COLOR)
      ]
    });

    await interaction.reply({ ephemeral: true, content: "🙏 Tack för ditt omdöme!" });

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 10000);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
