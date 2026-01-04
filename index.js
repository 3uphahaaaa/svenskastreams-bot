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

/* ================= CONFIG ================= */
const CONFIG = {
  BRAND: { NAME: "Svenska Streams", COLOR: "#7b3fe4" },

  CHANNELS: {
    PANEL: "1452057166721581216",
    WELCOME: "1452047332278538373",
    BUY_CATEGORY: "1452706749340586025",
    SUPPORT_CATEGORY: "1452706558226989089",

    VOUCH: "1452263084646338582",
    FINISHED: "1452285768742600755",
    DELIVERY_LOGS: "1453100303434911804"
  },

  ROLES: {
    MEMBER: "1452050878839394355",
    SELLER: "1452263273528299673"
  },

  PAYMENTS: {
    SWISH: "0736816921 (Oliver M)",
    PAYPAL: "@3upweru"
  }
};

/* ================= PRODUCTS ================= */
const PRODUCTS = {
  "🎵 Spotify Premium": "69 kr",
  "🎬 Netflix Premium": "69 kr",
  "📺 HBO Max Premium": "69 kr",
  "🍿 Disney+ Premium": "69 kr",
  "🔐 NordVPN Premium": "69 kr",
  "🚀 Discord Boosts (3 mån)": "109 kr",
  "👥 Discord Members (500 st)": "50 kr"
};

/* ================= STATE ================= */
const tickets = new Map();
const sellerLastActive = new Map();
const genOrderId = () => `SS-${Math.floor(100000 + Math.random() * 900000)}`;

/* ================= READY / PANEL ================= */
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.tag} online`);

  const panel = await client.channels.fetch(CONFIG.CHANNELS.PANEL);
  const msgs = await panel.messages.fetch({ limit: 10 });
  msgs.filter(m => m.author.id === client.user.id).forEach(m => m.delete().catch(() => {}));

  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎟 Svenska Streams")
        .setDescription(
          "Premiumtjänster • Snabb leverans • Trygg handel\n\n" +
          "🛒 Köp premium\n🛠 Support\n💡 Förslag"
        )
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_buy").setLabel("🛒 Köp").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_support").setLabel("🛠 Support").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticket_suggest").setLabel("💡 Förslag").setStyle(ButtonStyle.Secondary)
      )
    ]
  });
});

/* ================= AUTOROLE + WELCOME ================= */
client.on(Events.GuildMemberAdd, async member => {
  const role = member.guild.roles.cache.get(CONFIG.ROLES.MEMBER);
  if (role) await member.roles.add(role).catch(() => {});

  const ch = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
  if (!ch) return;

  ch.send({
    content: `👋 Välkommen ${member}!`,
    embeds: [
      new EmbedBuilder()
        .setTitle("Välkommen till Svenska Streams 🚀")
        .setDescription(
          "Billiga premiumtjänster med snabb leverans.\n\n" +
          `🎟 Skapa ticket här → <#${CONFIG.CHANNELS.PANEL}>`
        )
        .setColor(CONFIG.BRAND.COLOR)
    ]
  });
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
    const ch = interaction.channel;

    /* ===== CREATE TICKETS ===== */
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.customId.split("_")[1];
      const orderId = genOrderId();

      const ticket = await interaction.guild.channels.create({
        name: `${type}-${interaction.user.username}-${orderId}`,
        type: ChannelType.GuildText,
        parent: type === "buy" ? CONFIG.CHANNELS.BUY_CATEGORY : CONFIG.CHANNELS.SUPPORT_CATEGORY,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          { id: CONFIG.ROLES.SELLER, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      tickets.set(ticket.id, {
        userId: interaction.user.id,
        orderId,
        type
      });

      if (type === "buy") {
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
                  Object.entries(PRODUCTS).map(([p, price]) => ({
                    label: `${p} – ${price}`,
                    value: p
                  }))
                )
            )
          ]
        });
      } else if (type === "support") {
        await ticket.send("🛠 Beskriv ditt problem så hjälper vi dig.");
      } else {
        await ticket.send("💡 Skriv ditt förslag här.");
      }

      return interaction.editReply(`🎟 Ticket skapad: ${ticket}`);
    }

    /* ===== BUY FLOW ===== */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
      const t = tickets.get(ch.id);
      t.product = interaction.values[0];
      t.price = PRODUCTS[t.product];

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("⏳ Order mottagen")
            .setDescription(`Produkt: **${t.product}**\nPris: **${t.price}**`)
            .setColor("Orange")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("seller_approve").setLabel("✅ Godkänn order").setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    if (interaction.isButton() && interaction.customId === "seller_approve") {
      if (!interaction.member.roles.cache.has(CONFIG.ROLES.SELLER))
        return interaction.reply({ ephemeral: true, content: "Endast säljare." });

      sellerLastActive.set(interaction.user.id, Date.now());

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Betalning")
            .setDescription(
              `Swish: **${CONFIG.PAYMENTS.SWISH}**\n` +
              `PayPal: **${CONFIG.PAYMENTS.PAYPAL}**\n\n` +
              `Skicka screenshot efter betalning.`
            )
            .setColor(CONFIG.BRAND.COLOR)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("seller_payment_ok").setLabel("✅ Bekräfta betalning").setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    if (interaction.isButton() && interaction.customId === "seller_payment_ok") {
      if (!interaction.member.roles.cache.has(CONFIG.ROLES.SELLER))
        return interaction.reply({ ephemeral: true, content: "Endast säljare." });

      return interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("deliver").setLabel("📦 Leverera konto").setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    if (interaction.isButton() && interaction.customId === "deliver") {
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

    if (interaction.isModalSubmit() && interaction.customId === "deliver_modal") {
      const t = tickets.get(ch.id);
      const user = await client.users.fetch(t.userId);

      const email = interaction.fields.getTextInputValue("email");
      const password = interaction.fields.getTextInputValue("password");

      await user.send(
        `📦 **Leverans – Svenska Streams**\n\n` +
        `Produkt: ${t.product}\nPris: ${t.price}\n\n` +
        `Email: ${email}\nLösenord: ${password}\n\n` +
        `Kontot är **shared**. Ändra inget.\n` +
        `Gå tillbaka till ticket och bekräfta.`
      ).catch(() => ch.send("⚠️ Kundens DM är stängt."));

      await client.channels.fetch(CONFIG.CHANNELS.DELIVERY_LOGS).then(c =>
        c.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("📦 Leverans genomförd")
              .addFields(
                { name: "Order ID", value: t.orderId },
                { name: "Kund", value: `<@${t.userId}>` },
                { name: "Produkt", value: t.product },
                { name: "Pris", value: t.price }
              )
              .setColor("#22c55e")
              .setTimestamp()
          ]
        })
      );

      await ch.send({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_working").setLabel("✅ Kontot fungerar").setStyle(ButtonStyle.Success)
          )
        ]
      });

      return interaction.reply({ ephemeral: true, content: "Leverans skickad." });
    }

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
      const t = tickets.get(ch.id);

      await client.channels.fetch(CONFIG.CHANNELS.VOUCH).then(c =>
        c.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("⭐ Kundomdöme")
              .setDescription(
                `${"⭐".repeat(Number(interaction.fields.getTextInputValue("stars")))}\n\n` +
                interaction.fields.getTextInputValue("text")
              )
              .addFields(
                { name: "Produkt", value: t.product, inline: true },
                { name: "Pris", value: t.price, inline: true }
              )
              .setColor("#f5c542")
          ]
        })
      );

      await client.channels.fetch(CONFIG.CHANNELS.FINISHED).then(c =>
        c.send(`✅ Order klar: ${t.product} – ${t.price}`)
      );

      await interaction.reply("🙏 Tack för din order! Ticket stängs om 10 sek.");
      setTimeout(() => ch.delete().catch(() => {}), 10000);
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied)
      interaction.reply({ ephemeral: true, content: "⚠️ Ett fel uppstod." }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
