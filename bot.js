const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')

const client = new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers]
})

const CLIENT_ID = "1483191419135856722"

// load files
let birthdays = fs.existsSync('./birthdays.json')
? JSON.parse(fs.readFileSync('./birthdays.json','utf8'))
: {}

let settings = fs.existsSync('./settings.json')
? JSON.parse(fs.readFileSync('./settings.json','utf8'))
: {birthdayChannel:null,birthdayRole:null,controlRoles:[]}

// save functions
function saveBirthdays(){fs.writeFileSync('./birthdays.json',JSON.stringify(birthdays,null,2))}
function saveSettings(){fs.writeFileSync('./settings.json',JSON.stringify(settings,null,2))}

// helpers
function cap(str){return str.charAt(0).toUpperCase()+str.slice(1)}

function suffix(d){
if(d%10===1 && d!==11)return "st"
if(d%10===2 && d!==12)return "nd"
if(d%10===3 && d!==13)return "rd"
return "th"
}

const months=["January","February","March","April","May","June","July","August","September","October","November","December"]

function formatDate(m,d){
return `${months[m-1]} ${d}${suffix(d)}`
}

function daysUntil(m,d){
const now=new Date()
const target=new Date(now.getFullYear(),m-1,d)

if(target<now) target.setFullYear(target.getFullYear()+1)

return Math.ceil((target-now)/(1000*60*60*24))
}

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is alive');
});

server.listen(process.env.PORT || 10000, () => {
  console.log('Web server running');
});

// COMMANDS
const commands = [

new SlashCommandBuilder()
.setName("birthday")
.setDescription("Set your birthday (MM/DD)")
.addStringOption(o =>
  o.setName("date")
   .setDescription("Example: 3/18")
   .setRequired(true)
),

new SlashCommandBuilder().setName("checkbirthday").setDescription("Check a birthday")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder().setName("birthdaylist").setDescription("List birthdays"),

new SlashCommandBuilder().setName("setbirthdaychannel").setDescription("Set channel")
.addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),

new SlashCommandBuilder().setName("setbirthdayrole").setDescription("Set role")
.addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)),

new SlashCommandBuilder().setName("birthdaytest").setDescription("Test birthday message")

]

// READY
client.once("ready",async()=>{

console.log(`Logged in as ${client.user.tag}`)

const rest = new REST({version:"10"}).setToken(process.env.TOKEN)

for(const cmd of commands){
try{
await rest.post(Routes.applicationCommands(CLIENT_ID),{body:cmd.toJSON()})
console.log(`Registered ${cmd.name}`)
}catch(e){console.log(e)}
}

setInterval(checkBirthdays,60000)
})

// INTERACTIONS
client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return

if (!interaction.deferred && !interaction.replied) {
  await interaction.deferReply().catch(() => {})
}

try{

// SET BIRTHDAY
if(interaction.commandName==="birthday"){

const input = interaction.options.getString("date")

if(!/^\d{1,2}\/\d{1,2}$/.test(input)){
return interaction.editReply({embeds:[embed("Error","Use format like 3/18")]})
}

const [m,d] = input.split("/").map(Number)

if(m<1||m>12||d<1||d>31){
return interaction.editReply({embeds:[embed("Error","Invalid date")]})
}

birthdays[interaction.user.id]={month:m,day:d}
saveBirthdays()

return interaction.editReply({
embeds:[embed("Birthday Saved",`${cap(interaction.user.username)}'s birthday saved as ${formatDate(m,d)}`)]
})
}

// CHECK
if(interaction.commandName==="checkbirthday"){

const user=interaction.options.getUser("user")

if(!birthdays[user.id])
return interaction.editReply({embeds:[embed("Error","No birthday saved")]})

const b=birthdays[user.id]
const days=daysUntil(b.month,b.day)

return interaction.editReply({
embeds:[embed(
`${cap(user.username)}'s Birthday`,
`${formatDate(b.month,b.day)} - ${days} ${days===1?"day":"days"} away`
)]
})
}

// LIST
if(interaction.commandName==="birthdaylist"){

const list=[]

for(const id in birthdays){

const user=await client.users.fetch(id).catch(()=>null)
if(!user) continue

const b=birthdays[id]

list.push({
name:cap(user.username),
date:formatDate(b.month,b.day),
days:daysUntil(b.month,b.day)
})
}

list.sort((a,b)=>a.days-b.days)

if(list.length===0)
return interaction.editReply({embeds:[embed("List","No birthdays")]})

let text=list.map(b=>`• ${b.name} — ${b.date} (${b.days} days)`).join("\n")

return interaction.editReply({
embeds:[embed("🎂 Birthday List",text)]
})
}

// SET CHANNEL
if(interaction.commandName==="setbirthdaychannel"){
settings.birthdayChannel=interaction.options.getChannel("channel").id
saveSettings()
return interaction.editReply({embeds:[embed("Done","Channel set")]})
}

// SET ROLE
if(interaction.commandName==="setbirthdayrole"){
settings.birthdayRole=interaction.options.getRole("role").id
saveSettings()
return interaction.editReply({embeds:[embed("Done","Role set")]})
}

// TEST
if(interaction.commandName==="birthdaytest"){
return interaction.editReply({
embeds:[embed("🎉 Happy Birthday!",`<@${interaction.user.id}> 🎉`)]
})
}

}catch(e){
console.log(e)

if (!interaction.replied) {
  interaction.reply({ content: "Error", ephemeral: true }).catch(() => {})
}

// CHECK LOOP
async function checkBirthdays(){

const now=new Date()

for(const guild of client.guilds.cache.values()){

const channel=guild.channels.cache.get(settings.birthdayChannel)
if(!channel) continue

for(const id in birthdays){

const b=birthdays[id]

if(now.getMonth()+1===b.month && now.getDate()===b.day){

channel.send({
embeds:[embed("🎉 Happy Birthday!",`<@${id}> 🎉`)]
})

if(settings.birthdayRole){
const member=await guild.members.fetch(id).catch(()=>null)
if(member) member.roles.add(settings.birthdayRole).catch(()=>{})
}
}
}
}
}

client.login(process.env.TOKEN)

process.on('unhandledRejection', console.error)
process.on('uncaughtException', console.error)
