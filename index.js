// ================= BASIC SETUP =================
require("dotenv").config();
const {
  Client, GatewayIntentBits, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType,
  PermissionsBitField, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle
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

// ================= READY =================
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.tag} online`);

  const panel = await client.channels.fetch(CONFIG.CHANNELS.PANEL);
  const msgs = await panel.messages.fetch({ limit: 10 });
  msgs.filter(m => m.author.id === client.user.id).forEach(m => m.delete().catch(() => {}));

  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎟 Svenska Streams – Tickets")
        .setDescription("🛒 Köp billiga premiumtjänster med snabb leverans")
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Köp")
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
        `Billiga & säkra **premiumtjänster** med snabb leverans\n\n` +

        `🛒 **Marknad**\n` +
        `Spotify • Netflix • HBO Max • Disney+ • NordVPN\n` +
        `Boosts • Members\n\n` +

        `🎟 **Köp direkt**\n` +
        `Skapa ticket här → <#${CONFIG.CHANNELS.PANEL}>\n\n` +

        `⭐ **Omdömen:** <#${CONFIG.CHANNELS.VOUCH}>\n` +
        `✅ **Färdiga orders:** <#${CONFIG.CHANNELS.FINISHED}>`
      )
      .setColor(CONFIG.BRAND.COLOR)
      .setFooter({
        text: "Svenska Streams • Snabbt • Tryggt • Enkelt"
      })
  ]
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
      {
        id: interaction.guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages
        ]
      },
      {
        id: CONFIG.ROLES.SELLER,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages
        ]
      }
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
        .setDescription("Välj vad du vill köpa i listan nedan")
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select_product")
          .setPlaceholder("Välj produkt")
          .addOptions(
            Object.entries(PRODUCTS).map(([product, price]) => ({
              label: `${product} – ${price}`,
              value: product
            }))
          )
      )
    ]
  });

  return interaction.editReply({
    content: `🎟️ Ticket skapad: ${ticket}`
  });
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
            .setDescription(`**Produkt:** ${t.product}\n**Pris:** ${t.price}\n\nVäntar på säljare.`)
            .setColor("Orange")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("seller_approve")
              .setLabel("✅ Godkänn order")
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
        embeds: [new EmbedBuilder().setTitle("💳 Betalning").setDescription("Välj betalmetod")],
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
      ? "📱 **Swish:** `0736816921` (Oliver M)"
      : "💻 **PayPal:** `@3upweru`";

  const logChannel =
    t.payment === "Swish"
      ? CONFIG.CHANNELS.SWISH_LOGS
      : CONFIG.CHANNELS.PAYPAL_LOGS;

  await client.channels.fetch(logChannel).then(c =>
    c.send(
      `💸 **Betalningsmetod vald**\n` +
      `🆔 Order: ${t.orderId}\n` +
      `💳 Metod: ${t.payment}\n` +
      `👤 Kund: <@${t.userId}>`
    )
  );

  return interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle("📸 Betalningsinstruktioner")
        .setDescription(
          `🧾 **Order ID:** \`${t.orderId}\`\n\n` +
          `🛒 **Produkt:** ${t.product}\n` +
          `💰 **Pris:** ${t.price}\n` +
          `💳 **Metod:** ${t.payment}\n\n` +
          `➡️ **Betala till:**\n${payTo}\n\n` +
          `📸 **VIKTIGT:**\n` +
          `• Skicka **screenshot på betalningen** i denna ticket\n` +
          `• Inga orders godkänns utan screenshot\n` +
          `• En säljare verifierar manuellt`
        )
        .setColor(CONFIG.BRAND.COLOR)
        .setFooter({ text: "Svenska Streams • Säker betalning" })
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

    // ===== DELIVERY =====
    if (interaction.isButton() && interaction.customId === "deliver_account") {
      const modal = new ModalBuilder().setCustomId("deliver_modal").setTitle("📦 Leverera konto");

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

      await user.send(
await user.send(
`📦 **Leverans klar – Svenska Streams**

Hej **${user.username}** 👋  
Tack för ditt köp! Här är **inloggningsuppgifterna till ditt konto**:

━━━━━━━━━━━━
🧾 **Order**
• **ID:** ${t.orderId}
• **Produkt:** ${t.product}
• **Pris:** ${t.price}

━━━━━━━━━━━━
🔐 **Inlogg**
📧 **Email:** ${email}
🔑 **Lösenord:** ${password}

━━━━━━━━━━━━
📜 **Viktigt**
• Kontot är **delat (shared)**
• Ändra inget på kontot
• Testa direkt vid leverans

━━━━━━━━━━━━
✅ **Nästa steg**
Logga in → gå till ticket → klicka **“Kontot fungerar”** → lämna omdöme ⭐

— **Svenska Streams**`
);

        // ===== CONFIRM + REVIEW =====
    if (interaction.isButton() && interaction.customId === "confirm_working") {
      const modal = new ModalBuilder()
        .setCustomId("review")
        .setTitle("⭐ Omdöme");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("stars").setLabel("Betyg 1–5").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("text").setLabel("Omdöme").setStyle(TextInputStyle.Paragraph)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "review") {
      const t = tickets.get(ch.id);

      await client.channels.fetch(CONFIG.CHANNELS.VOUCH)
        .then(c =>
          c.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("🛡️ Trusted Seller – Order Completed")
                .setDescription(
                  `${"⭐".repeat(interaction.fields.getTextInputValue("stars"))}\n\n` +
                  `“${interaction.fields.getTextInputValue("text")}”`
                )
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


client.login(process.env.DISCORD_TOKEN);
