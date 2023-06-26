const TelegramBot = require('node-telegram-bot-api');
const { AIInterface } = require('./AIInterface.js');
const { extractJSON } = require('./vxAssistBotCommon.js');
const fs = require('fs');

class vxAssistBotBot {
  constructor() {
    this.bot = null;
    this.storageFile = 'botStorage.json';
    this.botToken = '';
    this.whiteListedGroups = new Set();
    this.adminUsers = [];
    this.commandCallbacks = {
      help: {
        adminOnly: false,
        callback: this.handleHelp.bind(this),
      },
      addadmin: {
        adminOnly: true,
        callback: this.handleAddAdmin.bind(this),
      },
      removeadmin: {
        adminOnly: true,
        callback: this.handleRemoveAdmin.bind(this),
      },
      addwhitelistedgroup: {
        adminOnly: true,
        callback: this.handleAddWhiteListedGroup.bind(this),
      },
      removewhitelistedgroup: {
        adminOnly: true,
        callback: this.handleRemoveWhiteListedGroup.bind(this),
      },
    };
  }

  start() {
    this.loadStorage();

    if (!this.botToken) {
      this.saveStorage();
      console.error('No bot token available. Exiting...');
      process.exit(1);
    }

    const bot = new TelegramBot(this.botToken, { polling: true });

    bot.getMe().then((botInfo) => {
      this.bot = bot;
      this.botInfo = botInfo;
      this.bot.on('message', (msg) => this.handleMessage(msg));
      this.bot.on('polling_error', (error) => console.log(error));

      console.log('Bot is running...');
    });
  }

  loadStorage() {
    if (fs.existsSync(this.storageFile)) {
      const data = fs.readFileSync(this.storageFile, 'utf8');
      const storage = JSON.parse(data);
      this.botToken = storage.botToken;
      this.whiteListedGroups = new Set(storage.whiteListedGroups);
      this.adminUsers = storage.adminUsers;
    }
  }

  saveStorage() {
    const storage = {
      botToken: this.botToken,
      whiteListedGroups: Array.from(this.whiteListedGroups),
      adminUsers: this.adminUsers,
    };
    fs.writeFileSync(this.storageFile, JSON.stringify(storage), 'utf8');
  }

  isAdminUser(username) {
    return this.adminUsers.includes(username);
  }

  parseCommand(text) {
    if (text) {
      const regex = /^\/([^\s]+)\s?(.*)$/;
      const matches = text.match(regex);

      if (matches) {
        const commandName = matches[1].toLowerCase();
        const params = matches[2] ? matches[2].split(' ') : [];
        return { commandName, params };
      }
    }

    return null;
  }

  executeCommand(msg, commandName, params) {
    const command = this.commandCallbacks[commandName];
    if (command) {
      if (command.adminOnly && !this.isAdminUser(msg.from.username)) {
        this.bot.sendMessage(msg.chat.id, 'You do not have permission to execute this command.');
      } else {
        try {
          command.callback(msg, params);
        } catch (error) {
          console.error(error);
          this.bot.sendMessage(msg.chat.id, 'An error occurred while executing the command.');
        }
      }
    }
  }

  handleMessage(msg) {

    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      if (this.whiteListedGroups.has(msg.chat.title)) {
        const command = this.parseCommand(msg.text);

        if (command) {
          const { commandName, params } = command;
          this.executeCommand(msg, commandName, params);
        } else {

          const aiId = msg.message_thread_id ? msg.message_thread_id : msg.chat.id;

          this.ai = this.ai ? this.ai : {};
          this.ai[msg.chat.id] = this.ai[msg.chat.id] ? this.ai[msg.chat.id] : {};
          this.ai[msg.chat.id][aiId] = this.ai[msg.chat.id][aiId] ? this.ai[msg.chat.id][aiId] : new AIInterface();

          let topic = "General Discussion";
          if (msg.reply_to_message && msg.reply_to_message.forum_topic_created) {
            topic = msg.reply_to_message.forum_topic_created.name;
          }

          const ai = this.ai[msg.chat.id][aiId];

          ai.assignRole([
            'Your name is vxAssistBot. You act as as 24 year old female assistant chatting on telegram.',
            `You provide professional and concise advice to your audience. You are an expert on ${topic}`
          ], {});

          if (msg.text) {
            if (!msg.text.includes(`@${this.botInfo.username}`)) {
              const promt = [
                'Rate a group chat messages probability in percent (0-100) and for each of the following statements:',
                '1. The message is directed to you',
                '2. The message is directed to someboy else',
                '3. The message is relevant',
                '4. You should respond to this message',
                '',
                'Reply with only a JSON object using the format: { directed_at_me: probability, directed_at_someone: probability, relevant: probability, should_respond: probability }',
                'If not enough information is available, set all probabilities to 0',
                '',
                'Message: {%message%}'
              ];

              ai.createCompletion(promt, { message: msg.text }).then(response => {
                ai.forget(promt);
                console.log(response);

                const rating = extractJSON(response.join('\n'));
                if (rating) {
                  if (rating.directed_at_me >= rating.directed_at_someone && rating.relevant >= 50) {
                    ai.createCompletion([msg.text], {}).then(response => {
                      this.bot.sendMessage(msg.chat.id, response.join('\n'), { message_thread_id: msg.message_thread_id });
                    }).catch(error => {
                      this.bot.sendMessage(msg.chat.id, error.message, { message_thread_id: msg.message_thread_id });
                    });
                  }
                }
              });
            } else {
              ai.createCompletion([msg.text], {}).then(response => {
                this.bot.sendMessage(msg.chat.id, response.join('\n'), { message_thread_id: msg.message_thread_id });
              }).catch(error => {
                this.bot.sendMessage(msg.chat.id, error.message, { message_thread_id: msg.message_thread_id });
              });
            }
          }
        }
      } else {
        this.bot.sendMessage(msg.chat.id, 'Not allowed');
        this.bot.leaveChat(msg.chat.id).catch(error => {
          // I don't care 
        });
      }
    } else if (this.isAdminUser(msg.from.username)) {
      const command = this.parseCommand(msg.text);
      if (command) {
        const { commandName, params } = command;
        this.executeCommand(msg, commandName, params);
      }
    }
  }

  handleHelp(msg, params) {
    let reply = 'Available commands:\n\n';
    for (const command of Object.keys(this.commandCallbacks)) {
      reply += `/${command}\n`;
    }
    this.bot.sendMessage(msg.chat.id, reply);
  }

  handleAddAdmin(msg, params) {
    const username = params[0];

    if (!this.adminUsers.includes(username)) {
      this.adminUsers.push(username);
      this.saveStorage();
      this.bot.sendMessage(msg.chat.id, `@${username} has been added as an admin user.`);
    } else {
      this.bot.sendMessage(msg.chat.id, `@${username} is already an admin user.`);
    }
  }

  handleRemoveAdmin(msg, params) {
    const username = params[0];

    const index = this.adminUsers.indexOf(username);
    if (index !== -1) {
      this.adminUsers.splice(index, 1);
      this.saveStorage();
      this.bot.sendMessage(msg.chat.id, `@${username} has been removed from admin users.`);
    } else {
      this.bot.sendMessage(msg.chat.id, `@${username} is not an admin user.`);
    }
  }

  handleAddWhiteListedGroup(msg, params) {
    const groupName = params[0];

    this.whiteListedGroups.add(groupName);
    this.saveStorage();
    this.bot.sendMessage(msg.chat.id, `Group ${groupName} has been whitelisted.`);
  }

  handleRemoveWhiteListedGroup(msg, params) {
    const groupName = params[0];

    if (this.whiteListedGroups.has(groupName)) {
      this.whiteListedGroups.delete(groupName);
      this.saveStorage();
      this.bot.sendMessage(msg.chat.id, `Group ${groupName} has been removed from the whitelist.`);
    } else {
      this.bot.sendMessage(msg.chat.id, `Group ${groupName} is not whitelisted.`);
    }
  }
}

const bot = new vxAssistBotBot();
bot.start();
