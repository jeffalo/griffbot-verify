const { users } = require('./db.js')

module.exports = async function (discordUser) {
  return new Promise(async (resolve, reject) => {
    let user = await users.findOne({ discord: discordUser.id })
    if (!user) return reject("no user")
    resolve({
      embed: {
        "title": `Verification Status (${discordUser.tag})`,
        "description": `**Current list of accounts:**\n${user.scratch.map(i => '- ' + i).join('\n')}\n\nLast updated: <t:${Math.floor(user.updated / 1000)}:R>.`,
        "color": '#00a9c0',
        "thumbnail": {
          "url": discordUser.displayAvatarURL()
        }
      }
    })
  })
}