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
      embeds: [
        new EmbedBuilder()
          .setTitle("👋 Välkommen till Svenska Streams!")
          .setDescription(
            `Billiga & säkra **premiumtjänster** med snabb leverans 🚀\n\n` +
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
  } catch (err) {
    console.error(err);
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
    name: `order-${orderId}`,
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

  return interaction.editReply(`🎟 Ticket skapad: ${ticket}`);
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

      const logChannel = t.payment === "Swish"
        ? CONFIG.CHANNELS.SWISH_LOGS
        : CONFIG.CHANNELS.PAYPAL_LOGS;

      await client.channels.fetch(logChannel)
        .then(c => c.send(`💸 Betalning vald: **${t.payment}**\nOrder: ${t.orderId}`));

      return interaction.update({
        embeds: [new EmbedBuilder().setTitle("📸 Betala").setDescription("Skicka screenshot efter betalning.")],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("seller_payment_ok")
              .setLabel("✅ Bekräfta betalning")
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
        `📦 **Din leverans**\n\n📧 ${interaction.fields.getTextInputValue("email")}\n🔐 ${interaction.fields.getTextInputValue("password")}`
      ).catch(() => ch.send("⚠️ Kundens DM är stängt."));

      await client.channels.fetch(CONFIG.CHANNELS.DELIVERY_LOGS)
        .then(c => c.send(`📦 Levererat order ${t.orderId}`));

      await ch.send({
        embeds: [new EmbedBuilder().setTitle("✅ Levererat")],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm_working")
              .setLabel("Kontot fungerar")
              .setStyle(ButtonStyle.Success)
          )
        ]
      });

      return interaction.reply({ ephemeral: true, content: "Levererat." });
    }

    // ===== CONFIRM + REVIEW =====
    if (interaction.isButton() && interaction.customId === "confirm_working") {
      const modal = new ModalBuilder().setCustomId("review").setTitle("⭐ Omdöme");

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
        .then(c => c.send(`⭐ **${interaction.fields.getTextInputValue("stars")}**\n${interaction.fields.getTextInputValue("text")}`));

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
