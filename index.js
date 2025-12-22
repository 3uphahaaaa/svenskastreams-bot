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

/* ================= CONFIG ================= */
const CONFIG = {
  BRAND: {
    NAME: "Svenska Streams",
    COLOR: "Purple",
    INVITE: "https://discord.gg/hNRyB2Mewv"
  },
  CHANNELS: {
    WELCOME: "1452047332278538373",
    TICKET_PANEL: "1452057166721581216",
    TICKET_CATEGORY: "1452057139618119821",
    ANNOUNCEMENTS: "1452389624801525992",
    LOGS: "1452624943543226501"
  },
  ROLES: {
    STAFF: "1452057264155267242",
    MEMBER: "1452050878839394355",
    CUSTOMER: "1452263553234108548"
  },
  PAYMENTS: {
    SWISH: "0736816921",
    LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
  },
  AUTO: {
    CLOSE_TICKET_AFTER: 10,
    COOLDOWN: 2500
  }
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
  console.log(`✅ ${CONFIG.BRAND.NAME} online som ${client.user.tag}`);

  const panel = await client.channels.fetch(CONFIG.CHANNELS.TICKET_PANEL);
  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🎟 ${CONFIG.BRAND.NAME} – Tickets`)
        .setDescription("🛒 Köp\n🤝 Samarbete")
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_buy").setLabel("🛒 Köp").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_partner").setLabel("🤝 Samarbete").setStyle(ButtonStyle.Secondary)
      )
    ]
  });
});

/* ================= WELCOME ================= */
client.on(Events.GuildMemberAdd, async member => {
  const role = member.guild.roles.cache.get(CONFIG.ROLES.MEMBER);
  if (role) await member.roles.add(role);
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

    /* ===== COOLDOWN ===== */
    if (interaction.isButton()) {
      if (cooldown.has(interaction.user.id))
        return interaction.reply({ content: "⏳ Vänta lite.", ephemeral: true });
      cooldown.add(interaction.user.id);
      setTimeout(() => cooldown.delete(interaction.user.id), CONFIG.AUTO.COOLDOWN);
    }

    /* ================= CREATE TICKET ================= */
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      if ([...tickets.values()].some(t => t.userId === interaction.user.id))
        return interaction.reply({ content: "❌ Du har redan en ticket.", ephemeral: true });

      const type = interaction.customId.split("_")[1];
      const channel = await interaction.guild.channels.create({
        name: `ticket-${type}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CONFIG.CHANNELS.TICKET_CATEGORY,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: CONFIG.ROLES.STAFF, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      tickets.set(channel.id, { userId: interaction.user.id, type });

      if (type === "buy") {
        const menu = new StringSelectMenuBuilder()
          .setCustomId("select_product")
          .setPlaceholder("Välj produkt")
          .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

        await channel.send({
          embeds: [new EmbedBuilder().setTitle("🛒 Välj produkt").setColor("Blue")],
          components: [new ActionRowBuilder().addComponents(menu)]
        });

        return interaction.reply({ content: `🎟 Ticket skapad: ${channel}`, ephemeral: true });
      }

      if (type === "partner") {
        const modal = new ModalBuilder().setCustomId("partner_form").setTitle("🤝 Samarbete");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("their_invite").setLabel("Deras Discord-invite").setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("their_ad").setLabel("Deras annons").setStyle(TextInputStyle.Paragraph)
          )
        );
        return interaction.showModal(modal);
      }
    }

    /* ================= SELECT PRODUCT ================= */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
      const t = tickets.get(interaction.channel.id);
      if (!t) return interaction.deferUpdate();

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

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("🛒 Produkt vald")
            .setDescription(`**${t.product}**\n\nVälj period:`)
            .setColor("Green")
        ],
        components: [new ActionRowBuilder().addComponents(menu)]
      });

      const log = await client.channels.fetch(CONFIG.CHANNELS.LOGS);
      await log.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🛒 Nytt köp påbörjat")
            .setColor("Green")
            .addFields(
              { name: "Kund", value: `<@${t.userId}>`, inline: true },
              { name: "Produkt", value: t.product, inline: true },
              { name: "Ticket", value: interaction.channel.toString(), inline: false }
            )
            .setTimestamp()
        ]
      });
    }

    /* ================= SELECT DURATION ================= */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
      const t = tickets.get(interaction.channel.id);
      if (!t) return interaction.deferUpdate();

      const [duration, price] = interaction.values[0].split("|");
      t.duration = duration;
      t.price = price;

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Betalning")
            .setDescription(
              `**${t.product}**\n${duration} – ${price}\n\n` +
              `Swish: ${CONFIG.PAYMENTS.SWISH}\nLTC:\n${CONFIG.PAYMENTS.LTC}`
            )
            .setColor("Purple")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_paid").setLabel("Jag har betalat").setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    /* ================= CONFIRM PAID ================= */
    if (interaction.isButton() && interaction.customId === "confirm_paid") {
      const modal = new ModalBuilder().setCustomId("deliver").setTitle("📦 Leverera konto");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("email").setLabel("Email").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("password").setLabel("Lösenord").setStyle(TextInputStyle.Short))
      );
      return interaction.showModal(modal);
    }

    /* ================= DELIVER ================= */
    if (interaction.isModalSubmit() && interaction.customId === "deliver") {
      const t = tickets.get(interaction.channel.id);
      if (!t) return interaction.reply({ content: "❌ Ticket hittades inte.", ephemeral: true });

      const user = await client.users.fetch(t.userId);
      await user.send(
`📦 **Ditt konto**
${t.product}
${t.duration}
Pris: ${t.price}

📧 ${interaction.fields.getTextInputValue("email")}
🔑 ${interaction.fields.getTextInputValue("password")}`
      );

      const role = interaction.guild.roles.cache.get(CONFIG.ROLES.CUSTOMER);
      if (role) await interaction.member.roles.add(role);

      const log = await client.channels.fetch(CONFIG.CHANNELS.LOGS);
      await log.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Köp slutfört")
            .setColor("Blue")
            .addFields(
              { name: "Kund", value: user.tag, inline: true },
              { name: "Produkt", value: t.product, inline: true },
              { name: "Pris", value: t.price, inline: true }
            )
            .setTimestamp()
        ]
      });

      await interaction.reply("✅ Levererat. Ticket stängs.");
      setTimeout(() => interaction.channel.delete(), CONFIG.AUTO.CLOSE_TICKET_AFTER * 1000);
    }

    /* ================= PARTNER FORM ================= */
    if (interaction.isModalSubmit() && interaction.customId === "partner_form") {
      const t = tickets.get(interaction.channel.id);
      if (!t) return interaction.reply({ content: "❌ Ticket hittades inte.", ephemeral: true });

      t.invite = interaction.fields.getTextInputValue("their_invite");
      t.ad = interaction.fields.getTextInputValue("their_ad");

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📨 Samarbetsförslag")
            .setDescription(t.ad)
            .setColor("Orange")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("partner_approve").setLabel("Godkänn").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("partner_deny").setLabel("Neka").setStyle(ButtonStyle.Danger)
          )
        ]
      });

      await interaction.reply({ content: "✅ Skickat till staff.", ephemeral: true });
    }

    /* ================= PARTNER APPROVE ================= */
    if (interaction.isButton() && interaction.customId === "partner_approve") {
      if (!interaction.member.roles.cache.has(CONFIG.ROLES.STAFF))
        return interaction.reply({ content: "❌ Endast staff.", ephemeral: true });

      const t = tickets.get(interaction.channel.id);
      if (!t) return interaction.deferUpdate();

      await client.channels.fetch(CONFIG.CHANNELS.ANNOUNCEMENTS)
        .then(ch => ch.send(`${t.ad}\n\n👉 ${t.invite}`));

      const user = await client.users.fetch(t.userId);
      await user.send(`🎬 ${CONFIG.BRAND.NAME}\n👉 ${CONFIG.BRAND.INVITE}`);

      const log = await client.channels.fetch(CONFIG.CHANNELS.LOGS);
      await log.send(`✅ Samarbete godkänt – ${user.tag}`);

      await interaction.reply("✅ Godkänt. Ticket stängs.");
      setTimeout(() => interaction.channel.delete(), CONFIG.AUTO.CLOSE_TICKET_AFTER * 1000);
    }

    /* ================= PARTNER DENY ================= */
    if (interaction.isButton() && interaction.customId === "partner_deny") {
      const t = tickets.get(interaction.channel.id);
      if (!t) return interaction.deferUpdate();

      const user = await client.users.fetch(t.userId);
      const log = await client.channels.fetch(CONFIG.CHANNELS.LOGS);
      await log.send(`❌ Samarbete nekad – ${user.tag}`);

      await interaction.reply("❌ Nekad.");
      setTimeout(() => interaction.channel.delete(), CONFIG.AUTO.CLOSE_TICKET_AFTER * 1000);
    }

  } catch (err) {
    console.error("❌ Interaction error:", err);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: "⚠️ Ett fel uppstod. Försök igen.", ephemeral: true });
      } catch {}
    }
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
