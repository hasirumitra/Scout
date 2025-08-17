import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly twilioClient: twilio.Twilio;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    
    this.isEnabled = !!(accountSid && authToken);
    
    if (this.isEnabled) {
      this.twilioClient = twilio(accountSid, authToken);
    } else {
      this.logger.warn('Twilio credentials not configured, SMS functionality disabled');
    }
  }

  async sendOtp(phone: string, otp: string, language: string = 'hi'): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.log(`SMS disabled - OTP ${otp} for ${phone}`);
      return true;
    }

    try {
      const message = this.getOtpMessage(otp, language);
      const fromNumber = this.configService.get<string>('twilio.phoneNumber');

      const result = await this.twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: phone,
      });

      this.logger.log(`OTP SMS sent successfully to ${phone}, SID: ${result.sid}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send OTP SMS to ${phone}:`, error.message);
      return false;
    }
  }

  async sendWelcomeMessage(phone: string, userName: string, language: string = 'hi'): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.log(`SMS disabled - Welcome message for ${phone}`);
      return true;
    }

    try {
      const message = this.getWelcomeMessage(userName, language);
      const fromNumber = this.configService.get<string>('twilio.phoneNumber');

      const result = await this.twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: phone,
      });

      this.logger.log(`Welcome SMS sent successfully to ${phone}, SID: ${result.sid}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome SMS to ${phone}:`, error.message);
      return false;
    }
  }

  async sendPasswordResetMessage(phone: string, language: string = 'hi'): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.log(`SMS disabled - Password reset message for ${phone}`);
      return true;
    }

    try {
      const message = this.getPasswordResetMessage(language);
      const fromNumber = this.configService.get<string>('twilio.phoneNumber');

      const result = await this.twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: phone,
      });

      this.logger.log(`Password reset SMS sent successfully to ${phone}, SID: ${result.sid}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset SMS to ${phone}:`, error.message);
      return false;
    }
  }

  private getOtpMessage(otp: string, language: string): string {
    const messages = {
      hi: `आपका हरिसु मित्र OTP है: ${otp}। यह 10 मिनट में समाप्त हो जाएगा। इसे किसी के साथ साझा न करें।`,
      en: `Your Hasiru Mitra OTP is: ${otp}. It expires in 10 minutes. Do not share it with anyone.`,
      kn: `ನಿಮ್ಮ ಹಸಿರು ಮಿತ್ರ OTP: ${otp}. ಇದು 10 ನಿಮಿಷಗಳಲ್ಲಿ ಅವಧಿ ಮುಗಿಯುತ್ತದೆ. ಇದನ್ನು ಯಾರೊಂದಿಗೂ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ।`,
    };

    return messages[language] || messages.hi;
  }

  private getWelcomeMessage(userName: string, language: string): string {
    const messages = {
      hi: `स्वागत है ${userName}! हरिसु मित्र में आपका स्वागत है। अब आप जैविक खेती के लिए AI-powered सलाह प्राप्त कर सकते हैं।`,
      en: `Welcome ${userName}! Welcome to Hasiru Mitra. You can now get AI-powered advice for organic farming.`,
      kn: `ಸ್ವಾಗತ ${userName}! ಹಸಿರು ಮಿತ್ರಗೆ ಸ್ವಾಗತ. ನೀವು ಈಗ ಸಾವಯವ ಕೃಷಿಗಾಗಿ AI-ಚಾಲಿತ ಸಲಹೆಯನ್ನು ಪಡೆಯಬಹುದು.`,
    };

    return messages[language] || messages.hi;
  }

  private getPasswordResetMessage(language: string): string {
    const messages = {
      hi: `आपका हरिसु मित्र पासवर्ड सफलतापूर्वक रीसेट हो गया है। यदि यह आप नहीं थे, तो तुरंत हमसे संपर्क करें।`,
      en: `Your Hasiru Mitra password has been reset successfully. If this wasn't you, please contact us immediately.`,
      kn: `ನಿಮ್ಮ ಹಸಿರು ಮಿತ್ರ ಪಾಸ್‌ವರ್ಡ್ ಯಶಸ್ವಿಯಾಗಿ ಮರುಹೊಂದಿಸಲಾಗಿದೆ. ಇದು ನೀವು ಅಲ್ಲದಿದ್ದರೆ, ದಯವಿಟ್ಟು ತಕ್ಷಣ ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ.`,
    };

    return messages[language] || messages.hi;
  }
}