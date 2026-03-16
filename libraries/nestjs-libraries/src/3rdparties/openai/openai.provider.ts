import {
  ThirdParty,
  ThirdPartyAbstract,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';

@ThirdParty({
  identifier: 'openai',
  title: 'OpenAI',
  description: 'Connect your OpenAI API key to power the AI agent.',
  position: 'ai',
  fields: [],
})
export class OpenaiThirdPartyProvider extends ThirdPartyAbstract {
  async checkConnection(
    apiKey: string
  ): Promise<false | { name: string; username: string; id: string }> {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        return false;
      }

      return { name: 'OpenAI', username: 'openai', id: 'openai' };
    } catch {
      return false;
    }
  }

  async sendData(): Promise<string> {
    return '';
  }
}
