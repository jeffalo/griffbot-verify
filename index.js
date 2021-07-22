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
    // if (message.deletable) message.delete()
    let code = addCode(message.author.id)
    message.author.send(`Your verification code is \`${code}\`. Paste it into https://scratch.mit.edu/projects/554914758/, and when you're done, reply \`g!done\` here.`)
      .catch(err => {
        console.error(err)
        message.reply(`something went wrong while I tried to send you a DM. Please make sure I am unblocked and you have your DMs open.`)
      })
    message.reply("please check your DMs to proceed.")
  } else if (message.content.startsWith('g!done')) {
    let scratchResponse = await fetch('https://clouddata.scratch.mit.edu/logs?projectid=554914758&limit=40&offset=0').then(r => r.json())
    // check if the code is in the array of cloud actions
    if (!codes.filter(i => i.discord === message.author.id)[0]) return message.author.send(`sorry. you failed verification. please try again.`)
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

      let rawUsers = await fs.promises.readFile('./users.json', 'utf8')
      let users = JSON.parse(rawUsers)
      let user = users.find(i => i.discord == message.author.id)
      if (user) {
        if (user.scratch.includes(cloudUpdate.user)) {
          return message.author.send(`you are already verified as ${cloudUpdate.user}.`)
        } else {
          user.scratch.push(cloudUpdate.user)
          user.updated = Date.now()
        }
      } else {
        // we add the user to the array
        users.push({ discord: message.author.id, scratch: [cloudUpdate.user], updated: Date.now() })
      }
      await fs.promises.writeFile('./users.json', JSON.stringify(users, null, 2), 'utf8')
      message.author.send({
        embed: {
          "title": "Verification Confirmation",
          "description": `You have added **${cloudUpdate.user}** as a scratch account. \n\n**Current list of accounts:**\n${users.find(i => i.discord == message.author.id).scratch.map(i => '- ' + i).join('\n')}\n\nYou can verify more accounts by typing g!verify.`,
          "color": '#00a9c0',
          "thumbnail": {
            "url": `https://my-ocular.jeffalo.net/api/user/${cloudUpdate.user}/picture`
          }
        }
      })
      codes = codes.filter(i => i.code !== code)
    } else {
      message.author.send(`sorry. you failed verification. please try again.`)
    }
  } else if (message.content.startsWith('g!whois')) {
    // if the user has the moderator role
    if (!message.member.roles.cache.get(process.env.MODERATOR_ROLE_ID)) return
    let rawUsers = await fs.promises.readFile('./users.json', 'utf8')
    let users = JSON.parse(rawUsers)
    let user = users.find(i => i.discord == message.mentions.users.first())
    if (user) {
      message.channel.send({
        embed: {
          "title": `Verification Status (${message.mentions.users.first().tag})`,
          "description": `**Current list of accounts:**\n${users.find(i => i.discord == message.mentions.users.first()).scratch.map(i => '- ' + i).join('\n')}\n\nLast updated: <t:${Math.floor(user.updated / 1000)}:R>.`,
          "color": '#00a9c0',
          "thumbnail": {
            "url": message.mentions.users.first().displayAvatarURL()
          }
        }
      })
    } else {
      message.channel.send('isnt verified.')
    }
  } else if (message.content.startsWith('g!scratchwhois')) {
    // get the discord accounts linked to a scratch username
    if (!message.member.roles.cache.get(process.env.MODERATOR_ROLE_ID)) return
    let rawUsers = await fs.promises.readFile('./users.json', 'utf8')
    let users = JSON.parse(rawUsers)
    let linkedUsers = users.filter(i => i.scratch.includes(message.content.split(' ')[1]))
    if (linkedUsers.length) {
      let discords = linkedUsers.map(i => `<@${i.discord}>`).join('\n')
      message.channel.send({
        embed: {
          "title": `Discord accounts linked for ${message.content.split(' ')[1]}`,
          "description": `**List of discord accounts:**\n${discords}`,
          "color": '#00a9c0',
        }
      })
    } else {
      message.channel.send(`${message.content.split(' ')[1]} isnt linked to any discords.`)
    }
  } else if (message.content.startsWith('g!remove')) {
    // if the user has one linked scratch account, remove them completely
    // otherwise, remove only one linked scratch account
    if (!message.member.roles.cache.get(process.env.MODERATOR_ROLE_ID)) return
    let rawUsers = await fs.promises.readFile('./users.json', 'utf8')
    let users = JSON.parse(rawUsers)

    let discordID = message.mentions.users.first().id
    let scratchUsername = message.content.split(' ')[2]
    let user = users.find(i => i.discord == discordID)
    if (user) {
      // if the user has a linked scratch account with the username
      if (user.scratch.includes(scratchUsername)) {
        // remove the linked scratch account
        user.scratch = user.scratch.filter(i => i !== scratchUsername)
        user.updated = Date.now()

        // if the user has now has no linked scratch accounts, remove them completely
        if (user.scratch.length == 0) {
          users = users.filter(i => i.discord != discordID)
        }

        await fs.promises.writeFile('./users.json', JSON.stringify(users, null, 2), 'utf8')
        message.channel.send({
          embed: {
            "title": `Verification Status (${message.mentions.users.first().tag})`,
            "description": `**Current list of accounts:**\n${users.find(i => i.discord == message.mentions.users.first()).scratch.map(i => '- ' + i).join('\n')}\n\nLast updated: <t:${Math.floor(user.updated / 1000)}:R>.`,
            "color": '#00a9c0',
            "thumbnail": {
              "url": message.mentions.users.first().displayAvatarURL()
            }
          }
        })
      } else {
        message.channel.send(`${scratchUsername} isnt linked to ${message.mentions.users.first().tag}.`)
      }
    } else {
      message.channel.send(`${message.mentions.users.first().tag} isnt linked to any scratch accounts.`)
    }
  }
})

client.on('guildMemberAdd', async (member) => { // role on rejoin
  // find the user in the users.json file
  let rawUsers = await fs.promises.readFile('./users.json', 'utf8')
  let users = JSON.parse(rawUsers)
  let user = users.find(i => i.discord == member.user.id)
  // if the user is in the file, they are verified. assign them the verified role.
  console.log(`${member.user.id} joined ${member.guild.name}`)
  if (user) {
    let server = client.guilds.cache.get(process.env.GUILD_ID);
    let verifiedRole = server.roles.cache.get(process.env.VERIFIED_ROLE_ID);
    member.roles.add(verifiedRole)
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