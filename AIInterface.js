const { Configuration, OpenAIApi } = require('openai');
const fs = require('fs');

class AIInterface {
    constructor(apiKey) {    
        if(!apiKey){
            apiKey = this.readApiKey('apikey.txt');
        }
        const configuration = new Configuration({
            apiKey
        });        
        this.client = new OpenAIApi(configuration);
        this.messages = [];
        this.lastQueryTimestamp = 0;
        this.queryCount = 0;
        this.queryLimit = 3;
        this.queryInterval = 60000; // 60 seconds
    }

    readApiKey(filePath) {
        const apiKey = fs.readFileSync(filePath, 'utf-8');
        return apiKey;
    }

    async sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    expandArguments(prompt, args) {
        return prompt.map(i => {
            Object.keys(args).forEach(j => {
                i = i.replace("{%" + j + "%}", args[j]);
            });
            return i;
        });
    };

    assignRole(role, parameter) {
        let messages = this.messages.filter(i => (i.role !== "system"));
        
        if(role && role.length){  
            let system = []; 
            this.expandArguments(role, parameter).forEach(i => {
                system.push({ role: 'system', content: i });
            });
            this.messages = [...system, ...messages];
        }
    }

    async createCompletion(user, temperature, parameter) {
        if (!user || user.length === 0) {
            return [];
        }

        const currentTime = Date.now();
        const timeSinceLastQuery = currentTime - this.lastQueryTimestamp;

        if (timeSinceLastQuery < this.queryInterval) {
            if (this.queryCount >= this.queryLimit) {
                const sleepTime = this.queryInterval - timeSinceLastQuery;
                await this.sleep(sleepTime);
                this.queryCount = 0;
            }
        } else {
            this.queryCount = 0;
        }

        user.length && this.expandArguments(user, parameter).forEach(i => {
            this.messages.push({ role: 'user', content: i });
        });

        let content = [];

        try {
            const response = await this.client.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages: [...this.messages],
                temperature: temperature,
                top_p: 1.0,
                frequency_penalty: 0.0,
                presence_penalty: 0.0,
                n: 1,
            });

            response.data.choices.forEach(i => {
                content.push(i.message.content);
                this.messages.push(i.message);
            });

            this.lastQueryTimestamp = Date.now();
            this.queryCount++;
        } catch (error) {
            if (error.response) {
                console.log(error.response.status);
                console.log(error.response.data);
            } else {
                console.log(error.message);
            }
        }

        return content;
    }
}

module.exports = {
    AIInterface
}
