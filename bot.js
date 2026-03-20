const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is alive'));
app.listen(PORT, () => console.log(`Web server running on ${PORT}`));

// ===== DISCORD SETUP =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ===== DATA =====
let birthdays = fs.existsSync('./birthdays.json')
  ? JSON.parse(fs.readFileSync('./birthdays.json', 'utf8'))
  : {};

let settings = fs.existsSync('./settings.json')
  ? JSON.parse(fs.readFileSync('./settings.json', 'utf8'))
  : { birthdayChannel: null, birthdayRole: null };

function saveBirthdays() {
  fs.writeFileSync('./birthdays.json', JSON.stringify(birthdays, null, 2));
}

function saveSettings() {
  fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
}

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Set your birthday (MM/DD)')
    .addStringOption(option =>
      option.setName('date')
        .setDescription('Example: 3/18')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('setbirthdaychannel')
    .setDescription('Set the birthday channel')
    .addChannelOption(option =>
      option.setName('channel').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('setbirthdayrole')
    .setDescription('Set the birthday role')
    .addRoleOption(option =>
      option.setName('role').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('birthdaytest')
    .setDescription('Test birthday message')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log('Commands registered');
});

// ===== COMMAND HANDLER =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'birthday') {
    const input = interaction.options.getString('date');
    const [month, day] = input.split('/').map(Number);

    if (!month || !day) {
      return interaction.reply({ content: 'Invalid format. Use MM/DD like 3/18', ephemeral: true });
    }

    birthdays[interaction.user.id] = { month, day };
    saveBirthdays();

    interaction.reply(`🎉 Birthday set to ${month}/${day}`);
  }

  if (commandName === 'setbirthdaychannel') {
    const channel = interaction.options.getChannel('channel');
    settings.birthdayChannel = channel.id;
    saveSettings();

    interaction.reply(`✅ Birthday channel set!`);
  }

  if (commandName === 'setbirthdayrole') {
    const role = interaction.options.getRole('role');
    settings.birthdayRole = role.id;
    saveSettings();

    interaction.reply(`✅ Birthday role set!`);
  }

  if (commandName === 'birthdaytest') {
    const channel = interaction.guild.channels.cache.get(settings.birthdayChannel);
    if (!channel) return interaction.reply('Channel not set');

    channel.send(`🎉 Happy Birthday! <@${interaction.user.id}> 🎉`);
    interaction.reply({ content: 'Sent test message!', ephemeral: true });
  }
});

// ===== BIRTHDAY CHECK =====
let sentToday = new Set();

setInterval(() => {
  const now = new Date();

  // EST FIX
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const month = est.getMonth() + 1;
  const day = est.getDate();

  for (const userId in birthdays) {
    const bday = birthdays[userId];
    const key = `${userId}-${month}-${day}`;

    if (bday.month === month && bday.day === day && !sentToday.has(key)) {
      sentToday.add(key);

      const guild = client.guilds.cache.first();
      const channel = guild.channels.cache.get(settings.birthdayChannel);

      if (!channel) return;

      channel.send(`🎉 Happy Birthday! <@${userId}> 🎉`);

      const member = guild.members.cache.get(userId);
      if (member && settings.birthdayRole) {
        member.roles.add(settings.birthdayRole).catch(() => {});
      }
    }
  }
}, 60 * 1000); // checks every minute

// reset daily
setInterval(() => {
  sentToday.clear();
}, 24 * 60 * 60 * 1000);

client.login(TOKEN);
