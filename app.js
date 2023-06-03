const { Console } = require('console');
const fs = require('fs');
const openai = require('openai');

class AIInterface {
  constructor(apiKey) {
    this.client = new openai.OpenAIApiClient(apiKey);
    this.messages = [];
  }

  async createCompletion(system, user, temperature) {
    system && this.messages.push({ role: 'system', content: system });
    user && this.messages.push({ role: 'user', content: user });

    const response = await this.client.createCompletion({
      model: 'text-davinci-003',
      messages: [...this.messages],
      max_tokens: 4096,
      temperature: temperature,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
    });

    const content = response.choices[0].message.content;

    this.messages.push({ role: 'assistant', content: content });

    return content;
  }
}

function readPersonaFile(filePath) {
  const personaData = fs.readFileSync(filePath, 'utf-8');
  return {
    name: 'Bob',
    temperature: '0.5',
    role: '',
    prompt: '',
    ...JSON.parse(personaData)};
}

function generateFilename(writer, editor, title) {
  const writerName = writer.name.replace(/\s+/g, '_');
  const editorName = editor.name.replace(/\s+/g, '_');
  const filename = `${writerName}_${editorName}_${title}.txt`;
  return filename;
}

function saveContentToFile(filename, content) {
  fs.writeFileSync(filename, content);
  console.log(`Content saved to file: ${filename}`);
}

async function main() {
  const apiKey = 'YOUR_OPENAI_API_KEY';
  const writerPersonaFile = 'path/to/writer_persona.json';
  const editorPersonaFile = 'path/to/editor_persona.json';
  const title = 'My Fictional Story';
  const iterations = 2; // Default number of iterations

  const writerPersona = readPersonaFile(writerPersonaFile);
  const editorPersona = readPersonaFile(editorPersonaFile);

  const writerAI = new AIInterface(apiKey);
  const editorAI = new AIInterface(apiKey);

  let editorResponse = await editorAI.createCompletion(editorPersona.role, editorPersona.prompt, editorPersona.temperature);
  let writerResponse = await writerAI.createCompletion(writerPersona.role, writerPersona.prompt, writerResponse.temperature);

  for (let i = 0; i < iterations; i++) {
    console.log(`Iteration ${i + 1}`);

    editorResponse = await editorAI.createCompletion(null, writerResponse, writerResponse.temperature);
    writerResponse = await writerAI.createCompletion(null, editorResponse, editorPersona.temperature);
  }

  const filename = generateFilename(writerPersona, editorPersona, title);
  saveContentToFile(filename, writerResponse);
}

main().catch((error) => {
  console.error('An error occurred:', error);
});
