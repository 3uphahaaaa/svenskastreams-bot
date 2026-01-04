// ================= BASIC SETUP =================
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// ================= CONFIG =================
const CONFIG = {
  BRAND: { NAME: "Svenska Streams", COLOR: "#7b3fe4" },

  CHANNELS: {
    WELCOME: "1452047332278538373",
    PANEL: "1452057166721581216",
    BUY_CATEGORY: "1452706749340586025",

    VOUCH: "1452263084646338582",
    FINISHED: "1452285768742600755",

    SWISH_LOGS: "1452671397871489175",
    PAYPAL_LOGS: "1453066917719048364",
    DELIVERY_LOGS: "1453100303434911804"
  },

  ROLES: {
    MEMBER: "1452050878839394355",
    SELLER: "1452263273528299673"
  }
};

// ================= PRODUCTS =================
const PRODUCTS = {
  "🎵 Spotify Premium": "69 kr",
  "🎬 Netflix Premium": "69 kr",
  "📺 HBO Max Premium": "69 kr",
  "🍿 Disney+ Premium": "69 kr",
  "🔐 NordVPN Premium": "69 kr",
  "🚀 Discord Boosts (3 mån)": "109 kr",
  "👥 Discord Members (500 st)": "50 kr"
};

const tickets = new Map();
const genOrderId = () => `SS-${Math.floor(100000 + Math.random() * 900000)}`;

// ================= READY / PANEL =================
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.tag} online`);

  const panel = await client.channels.fetch(CONFIG.CHANNELS.PANEL);
  const msgs = await panel.messages.fetch({ limit: 10 });
  msgs.filter(m => m.author.id === client.user.id).forEach(m => m.delete().catch(() => {}));

  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🛒 Svenska Streams – Köp Premium")
        .setDescription("Billiga premiumtjänster • Snabb leverans • Trygg handel")
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Skapa köp-ticket")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  });
});

// ================= AUTOROLE + WELCOME =================
client.on(Events.GuildMemberAdd, async member => {
  try {
    const role = member.guild.roles.cache.get(CONFIG.ROLES.MEMBER);
    if (role) await member.roles.add(role);

    const ch = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
    if (!ch) return;

    await ch.send({
      content: `👋 Välkommen ${member}!`,
      embeds: [
        new EmbedBuilder()
          .setTitle("Välkommen till Svenska Streams 🚀")
          .setDescription(
            `🛒 **Marknad**\nSpotify • Netflix • HBO Max • Disney+ • NordVPN\nBoosts • Members\n\n` +
            `🎟 **Köp direkt:** <#${CONFIG.CHANNELS.PANEL}>\n\n` +
            `⭐ **Omdömen:** <#${CONFIG.CHANNELS.VOUCH}>\n` +
            `✅ **Färdiga orders:** <#${CONFIG.CHANNELS.FINISHED}>`
          )
          .setColor(CONFIG.BRAND.COLOR)
          .setFooter({ text: "Svenska Streams • Snabbt • Tryggt • Enkelt" })
      ]
    });
  } catch (e) {
    console.error(e);
  }
});

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (
      !interaction.isButton() &&
      !interaction.isStringSelectMenu() &&
      !interaction.isModalSubmit()
    ) return;

    const ch = interaction.channel;

    // ===== CREATE TICKET =====
    if (interaction.isButton() && interaction.customId === "ticket_buy") {
      await interaction.deferReply({ ephemeral: true });

      const orderId = genOrderId();
      const ticket = await interaction.guild.channels.create({
        name: `order-${interaction.user.username}-${orderId}`,
        type: ChannelType.GuildText,
        parent: CONFIG.CHANNELS.BUY_CATEGORY,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          { id: CONFIG.ROLES.SELLER, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      tickets.set(ticket.id, {
        userId: interaction.user.id,
        orderId
      });

      await ticket.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🛒 Välj produkt")
            .setDescription("Välj vad du vill köpa")
            .setColor(CONFIG.BRAND.COLOR)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("select_product")
              .setPlaceholder("Välj produkt")
              .addOptions(
                Object.entries(PRODUCTS).map(([p, price]) => ({
                  label: `${p} – ${price}`,
                  value: p
                }))
              )
          )
        ]
      });

      return interaction.editReply(`🎟️ Ticket skapad: ${ticket}`);
    }

    // ===== PRODUCT SELECT =====
    if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
      const t = tickets.get(ch.id);
      t.product = interaction.values[0];
      t.price = PRODUCTS[t.product];

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("⏳ Order mottagen")
            .setDescription(`Produkt: **${t.product}**\nPris: **${t.price}**\n\nVäntar på säljare.`)
            .setColor("Orange")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("seller_approve")
              .setLabel("✅ Säljare: Godkänn order")
              .setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    // ===== SELLER APPROVE =====
    if (interaction.isButton() && interaction.customId === "seller_approve") {
      if (!interaction.member.roles.cache.has(CONFIG.ROLES.SELLER))
        return interaction.reply({ ephemeral: true, content: "Endast säljare." });

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Betalning")
            .setDescription("Välj betalningsmetod")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("pay_swish").setLabel("Swish").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("pay_paypal").setLabel("PayPal").setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    // ===== PAYMENT METHOD =====
    if (interaction.isButton() && interaction.customId.startsWith("pay_")) {
      const t = tickets.get(ch.id);
      t.payment = interaction.customId === "pay_swish" ? "Swish" : "PayPal";

      const payTo =
        t.payment === "Swish"
          ? "📱 Swish: **0736816921** (Oliver M)"
          : "💻 PayPal: **@3upweru**";

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("📸 Betalningsinstruktioner")
            .setDescription(
              `Order ID: \`${t.orderId}\`\n` +
              `Produkt: **${t.product}**\n` +
              `Pris: **${t.price}**\n\n` +
              `➡️ Betala till:\n${payTo}\n\n` +
              `📸 Skicka screenshot på betalningen i denna ticket.`
            )
            .setColor(CONFIG.BRAND.COLOR)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("seller_payment_ok")
              .setLabel("✅ Säljare: Bekräfta betalning")
              .setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    // ===== PAYMENT CONFIRMED =====
    if (interaction.isButton() && interaction.customId === "seller_payment_ok") {
      if (!interaction.member.roles.cache.has(CONFIG.ROLES.SELLER))
        return interaction.reply({ ephemeral: true, content: "Endast säljare." });

      return interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("deliver_account")
              .setLabel("📦 Leverera konto")
              .setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    // ===== DELIVERY MODAL =====
    if (interaction.isButton() && interaction.customId === "deliver_account") {
      const modal = new ModalBuilder()
        .setCustomId("deliver_modal")
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

    // ===== SEND ACCOUNT =====
    if (interaction.isModalSubmit() && interaction.customId === "deliver_modal") {
      const t = tickets.get(ch.id);
      const user = await client.users.fetch(t.userId);

      const email = interaction.fields.getTextInputValue("email");
      const password = interaction.fields.getTextInputValue("password");

      await user.send(
`📦 **Leverans klar – Svenska Streams**

Order ID: ${t.orderId}
Produkt: ${t.product}
Pris: ${t.price}

🔐 Inlogg:
Email: ${email}
Lösenord: ${password}

📜 Kontot är **shared**
Ändra inget på kontot.

➡️ Gå tillbaka till ticket och klicka **“Kontot fungerar”**`
      );

      await ch.send({
        embeds: [new EmbedBuilder().setTitle("📦 Leverans skickad i PM").setColor(CONFIG.BRAND.COLOR)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm_working")
              .setLabel("✅ Kontot fungerar")
              .setStyle(ButtonStyle.Success)
          )
        ]
      });

      return interaction.reply({ ephemeral: true, content: "Leverans skickad." });
    }

    // ===== CONFIRM + REVIEW =====
    if (interaction.isButton() && interaction.customId === "confirm_working") {
      const modal = new ModalBuilder()
        .setCustomId("review")
        .setTitle("⭐ Omdöme");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("stars").setLabel("Betyg (1–5)").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("text").setLabel("Omdöme").setStyle(TextInputStyle.Paragraph)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "review") {
      const t = tickets.get(ch.id);

      await client.channels.fetch(CONFIG.CHANNELS.VOUCH).then(c =>
        c.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🛡️ Trusted Seller – Order Completed")
              .setDescription(`⭐ ${interaction.fields.getTextInputValue("text")}`)
              .addFields(
                { name: "Produkt", value: t.product, inline: true },
                { name: "Pris", value: t.price, inline: true },
                { name: "Kund", value: `<@${t.userId}>`, inline: true }
              )
              .setColor("#f5c542")
              .setTimestamp()
          ]
        })
      );

      await client.channels.fetch(CONFIG.CHANNELS.FINISHED)
        .then(c => c.send(`✅ Order klar: ${t.product} – ${t.price}`));

      await interaction.reply("🙏 Tack för din order! Ticket stängs om 10 sek.");
      setTimeout(() => ch.delete().catch(() => {}), 10000);
    }

  } catch (e) {
    console.error(e);
    if (!interaction.replied)
      interaction.reply({ ephemeral: true, content: "Fel uppstod." }).catch(() => {});
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
