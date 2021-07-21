require('dotenv').config()

const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs')

const fetch = require('node-fetch')

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});


client.on('message', async message => {
  if (message.content.startsWith('g!verify')) {
    if (message.deletable) message.delete()
    let code = addCode(message.author.id)
    message.author.send(`Your verification code is \`${code}\`. Paste it into https://scratch.mit.edu/projects/554914758/, and when you're done, reply \`g!done\` here.`)
  } else if (message.content.startsWith('g!done')) {
    let scratchResponse = await fetch('https://clouddata.scratch.mit.edu/logs?projectid=554914758&limit=40&offset=0').then(r => r.json())
    // check if the code is in the array of cloud actions
    if(!codes.filter(i => i.discord === message.author.id)[0]) return message.author.send(`sorry. you failed verification. please try again.`)
    let code = codes.filter(i => i.discord === message.author.id)[0].code
    let cloudUpdate = scratchResponse.find(i => i.value == code.toString())
    // if the code is in the array, respond with their username
    if (cloudUpdate) {
      // assign the verified role to the user
      let server = client.guilds.cache.get(process.env.GUILD_ID);
      let member = server.members.cache.get(message.author.id)
      let verifiedRole = server.roles.cache.get(process.env.VERIFIED_ROLE_ID);

      member.roles.add(verifiedRole)

      let logChannel = server.channels.cache.get(process.env.LOG_CHANNEL_ID)
      logChannel.send(`${message.author.username} (${message.author.id}) verified as ${cloudUpdate.user}`)

      let rawUsers =  await fs.promises.readFile('./users.json', 'utf8')
      let users = JSON.parse(rawUsers)
      let user = users.find(i => i.discord == message.author.id)
      if(user) {
        if(user.scratch.includes(cloudUpdate.user)) {
          return message.author.send(`you are already verified as ${cloudUpdate.user}.`)
        } else {
          user.scratch.push(cloudUpdate.user)
        }
      } else {
        // we add the user to the array
        users.push({ discord: message.author.id, scratch: [cloudUpdate.user] })
      }
      await fs.promises.writeFile('./users.json', JSON.stringify(users, null, 2), 'utf8')
      message.author.send(`epic! you are now verified as ${cloudUpdate.user}. you can verify as many times as you want to add alt accounts.`)
      codes = codes.filter(i => i.code !== code)
    } else {
      message.author.send(`sorry. you failed verification. please try again.`)
    }
  } else if (message.content.startsWith('g!whois')) {
    // if the user has the moderator role
    if (!message.member.roles.cache.get(process.env.MODERATOR_ROLE_ID)) return
    let rawUsers =  await fs.promises.readFile('./users.json', 'utf8')
    let users = JSON.parse(rawUsers)
    let user = users.find(i => i.discord == message.mentions.users.first())
    if(user) {
      message.channel.send(`${user.scratch.join(', ')}`)
    } else {
      message.channel.send('isnt verified.')
    }
  }
})

let codes = []

function addCode(discord) {
  // code is a random 10 digit number
  let code = Math.floor(Math.random() * 10000000)
  // add the code to the array
  codes.push({ code: code, discord: discord })
  // return the code

  // schedule to remove the code in 5 minutes
  setTimeout(() => {
    // remove the code from the array
    codes = codes.filter(i => i.code !== code)
  }, 300000)
  return code
}

client.login(process.env.DISCORD_TOKEN);