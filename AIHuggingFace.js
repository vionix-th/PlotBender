const { HfInference } = require("@huggingface/inference")
const { readApiKey } = require("./vxAssistCommon");
require('colors');

class AIHuggingFace {
    Settings = {
        apiKey: readApiKey('apikeyHuggingFace.txt'),
        text2Image: {
            model: 'gsdf/Counterfeit-V2.5'
            // model: 'stabilityai/stable-diffusion-2-1'
            // model: 'dreamlike-art/dreamlike-photoreal-2.0'
            // model: 'prompthero/openjourney'
            // model: 'hakurei/waifu-diffusion'
        },
        text2Speech: {
            model: 'facebook/fastspeech2-en-ljspeech'
        }
    };

    async text2Speech(prompt, parameter) {
        const hf = new HfInference(this.Settings.apiKey);
        var result = [];

        var model = parameter.Text2SpeechModel ? parameter.Text2SpeechModel : this.Settings.text2Speech.model;

        for (let input of prompt.split('\n\n')) {
            let paragraph = await hf.textToSpeech({
                model: model,
                inputs: input
            })
            result.push(paragraph);
        }

        return result;
    }

    async createImage(ai, prompt, parameter) {        
        const hf = new HfInference(this.Settings.apiKey);

        var model = parameter.Text2ImageModel ? parameter.Text2ImageModel : this.Settings.text2Image.model;
        var negative_prompt = parameter.VisualStyleNegative ? `${parameter.VisualStyleNegative}, ${inputs}` : '';
        var inputs = ai.expandArguments([prompt], parameter)[0];        

        if(parameter.VisualStyle){
            inputs = `${parameter.VisualStyle}, ${inputs}`;
        }
        var result = await hf.textToImage({
            model: model,
            inputs,
            parameters: {
                negative_prompt
              }
        });

        return Buffer.from(await result.arrayBuffer());
    }
};



module.exports = {
    AIHuggingFace
}