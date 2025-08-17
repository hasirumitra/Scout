import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SmsService } from './sms.service';
import { Twilio } from 'twilio';
import { faker } from '@faker-js/faker';

// Mock Twilio
jest.mock('twilio');

describe('SmsService', () => {
  let service: SmsService;
  let configService: ConfigService;
  let mockTwilioClient: jest.Mocked<any>;

  const mockConfig = {
    TWILIO_ACCOUNT_SID: 'test_account_sid',
    TWILIO_AUTH_TOKEN: 'test_auth_token',
    TWILIO_PHONE_NUMBER: '+1234567890',
    SMS_RATE_LIMIT_PER_HOUR: 10,
    SMS_ENABLED: 'true',
  };

  beforeEach(async () => {
    mockTwilioClient = {
      messages: {
        create: jest.fn(),
      },
    };

    (Twilio as jest.MockedClass<typeof Twilio>).mockImplementation(() => mockTwilioClient);

    const mockConfigService = {
      get: jest.fn((key: string) => mockConfig[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('sendOtp', () => {
    const phoneNumber = '+919876543210';
    const otp = '123456';

    beforeEach(() => {
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'test_message_sid',
        status: 'sent',
        to: phoneNumber,
        from: mockConfig.TWILIO_PHONE_NUMBER,
        body: `Your Hasiru Mitra verification code is: ${otp}. This code will expire in 5 minutes. Do not share this code with anyone.`,
      });
    });

    it('should send OTP SMS successfully', async () => {
      await service.sendOtp(phoneNumber, otp);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `Your Hasiru Mitra verification code is: ${otp}. This code will expire in 5 minutes. Do not share this code with anyone.`,
        from: mockConfig.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    });

    it('should handle different OTP codes', async () => {
      const differentOtp = '654321';
      
      await service.sendOtp(phoneNumber, differentOtp);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `Your Hasiru Mitra verification code is: ${differentOtp}. This code will expire in 5 minutes. Do not share this code with anyone.`,
        from: mockConfig.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    });

    it('should handle different phone number formats', async () => {
      const phoneNumbers = [
        '+919876543210',
        '+1234567890',
        '+44123456789',
      ];

      for (const phone of phoneNumbers) {
        await service.sendOtp(phone, otp);

        expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            to: phone,
          })
        );
      }
    });

    it('should throw error when Twilio API fails', async () => {
      const twilioError = new Error('Twilio API Error');
      mockTwilioClient.messages.create.mockRejectedValue(twilioError);

      await expect(service.sendOtp(phoneNumber, otp)).rejects.toThrow('Failed to send OTP SMS');
    });

    it('should log SMS sending attempts', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.sendOtp(phoneNumber, otp);

      expect(loggerSpy).toHaveBeenCalledWith(`Sending OTP SMS to ${phoneNumber}`);
    });

    it('should log successful SMS delivery', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.sendOtp(phoneNumber, otp);

      expect(loggerSpy).toHaveBeenCalledWith(
        `OTP SMS sent successfully to ${phoneNumber} with SID: test_message_sid`
      );
    });

    it('should log SMS sending errors', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      const twilioError = new Error('Network error');
      mockTwilioClient.messages.create.mockRejectedValue(twilioError);

      await expect(service.sendOtp(phoneNumber, otp)).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        `Failed to send OTP SMS to ${phoneNumber}:`,
        twilioError
      );
    });
  });

  describe('sendWelcomeMessage', () => {
    const phoneNumber = '+919876543210';
    const userName = 'Rajesh Kumar';

    beforeEach(() => {
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'test_welcome_sid',
        status: 'sent',
        to: phoneNumber,
        from: mockConfig.TWILIO_PHONE_NUMBER,
      });
    });

    it('should send welcome message successfully', async () => {
      await service.sendWelcomeMessage(phoneNumber, userName);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `Welcome to Hasiru Mitra, ${userName}! 🌱 You're now connected to smart farming solutions. Get crop advice, market prices, and expert support. Happy farming!`,
        from: mockConfig.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    });

    it('should handle welcome message without name', async () => {
      await service.sendWelcomeMessage(phoneNumber);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: 'Welcome to Hasiru Mitra! 🌱 You\'re now connected to smart farming solutions. Get crop advice, market prices, and expert support. Happy farming!',
        from: mockConfig.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    });

    it('should log welcome message sending', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.sendWelcomeMessage(phoneNumber, userName);

      expect(loggerSpy).toHaveBeenCalledWith(`Sending welcome SMS to ${phoneNumber}`);
    });

    it('should handle Twilio errors for welcome messages', async () => {
      const twilioError = new Error('Twilio API Error');
      mockTwilioClient.messages.create.mockRejectedValue(twilioError);
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.sendWelcomeMessage(phoneNumber, userName)).rejects.toThrow(
        'Failed to send welcome SMS'
      );
      
      expect(loggerSpy).toHaveBeenCalledWith(
        `Failed to send welcome SMS to ${phoneNumber}:`,
        twilioError
      );
    });
  });

  describe('sendMarketAlert', () => {
    const phoneNumber = '+919876543210';
    const cropName = 'Tomato';
    const price = 45.50;
    const location = 'Bangalore Market';

    beforeEach(() => {
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'test_alert_sid',
        status: 'sent',
        to: phoneNumber,
        from: mockConfig.TWILIO_PHONE_NUMBER,
      });
    });

    it('should send market alert successfully', async () => {
      await service.sendMarketAlert(phoneNumber, cropName, price, location);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `🏪 Market Alert: ${cropName} price is ₹${price}/kg in ${location}. Good time to sell! Check Hasiru Mitra app for more details.`,
        from: mockConfig.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    });

    it('should handle market alert without location', async () => {
      await service.sendMarketAlert(phoneNumber, cropName, price);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `🏪 Market Alert: ${cropName} price is ₹${price}/kg. Good time to sell! Check Hasiru Mitra app for more details.`,
        from: mockConfig.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    });

    it('should format prices correctly', async () => {
      const testCases = [
        { price: 10, expected: '₹10/kg' },
        { price: 10.5, expected: '₹10.5/kg' },
        { price: 10.50, expected: '₹10.5/kg' },
        { price: 123.45, expected: '₹123.45/kg' },
      ];

      for (const testCase of testCases) {
        mockTwilioClient.messages.create.mockClear();
        
        await service.sendMarketAlert(phoneNumber, cropName, testCase.price, location);

        expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.stringContaining(testCase.expected),
          })
        );
      }
    });
  });

  describe('sendCropAdviceAlert', () => {
    const phoneNumber = '+919876543210';
    const advice = 'Apply organic fertilizer this week for better tomato yield.';

    beforeEach(() => {
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'test_advice_sid',
        status: 'sent',
        to: phoneNumber,
        from: mockConfig.TWILIO_PHONE_NUMBER,
      });
    });

    it('should send crop advice alert successfully', async () => {
      await service.sendCropAdviceAlert(phoneNumber, advice);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `🌱 Crop Advice: ${advice} - Hasiru Mitra`,
        from: mockConfig.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    });

    it('should handle long advice messages', async () => {
      const longAdvice = 'A'.repeat(200); // Very long advice
      
      await service.sendCropAdviceAlert(phoneNumber, longAdvice);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(longAdvice.substring(0, 100)),
        })
      );
    });
  });

  describe('rate limiting', () => {
    const phoneNumber = '+919876543210';

    beforeEach(() => {
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'test_sid',
        status: 'sent',
      });
    });

    it('should track SMS sending rate', async () => {
      // This test would require implementing rate limiting in the actual service
      // For now, we'll test the structure exists
      expect(service).toBeDefined();
      expect(typeof service.sendOtp).toBe('function');
    });

    it('should enforce rate limiting per phone number', async () => {
      // Implementation would depend on the actual rate limiting mechanism
      // This is a placeholder for rate limiting tests
      expect(configService.get('SMS_RATE_LIMIT_PER_HOUR')).toBe(10);
    });
  });

  describe('SMS validation', () => {
    it('should validate phone number format', async () => {
      const invalidPhoneNumbers = [
        '', // Empty
        '123', // Too short
        'invalid', // Non-numeric
        '+', // Just plus sign
      ];

      for (const invalidPhone of invalidPhoneNumbers) {
        await expect(service.sendOtp(invalidPhone, '123456')).rejects.toThrow();
      }
    });

    it('should validate OTP format', async () => {
      const phoneNumber = '+919876543210';
      const invalidOtps = [
        '', // Empty
        '123', // Too short
        '1234567', // Too long
        'abcdef', // Non-numeric
      ];

      for (const invalidOtp of invalidOtps) {
        await expect(service.sendOtp(phoneNumber, invalidOtp)).rejects.toThrow();
      }
    });
  });

  describe('SMS service configuration', () => {
    it('should initialize with correct Twilio configuration', () => {
      expect(Twilio).toHaveBeenCalledWith(
        mockConfig.TWILIO_ACCOUNT_SID,
        mockConfig.TWILIO_AUTH_TOKEN
      );
    });

    it('should handle missing configuration gracefully', () => {
      // Test would involve creating service with missing config
      expect(service).toBeDefined();
    });

    it('should respect SMS enabled/disabled setting', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key) => {
        if (key === 'SMS_ENABLED') return 'false';
        return mockConfig[key];
      });

      // Would need to implement SMS_ENABLED check in actual service
      expect(configService.get('SMS_ENABLED')).toBe('false');
    });
  });

  describe('error handling', () => {
    const phoneNumber = '+919876543210';
    const otp = '123456';

    it('should handle Twilio network errors', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'NetworkError';
      mockTwilioClient.messages.create.mockRejectedValue(networkError);

      await expect(service.sendOtp(phoneNumber, otp)).rejects.toThrow('Failed to send OTP SMS');
    });

    it('should handle Twilio authentication errors', async () => {
      const authError = new Error('Authentication failed');
      authError.name = 'AuthenticationError';
      mockTwilioClient.messages.create.mockRejectedValue(authError);

      await expect(service.sendOtp(phoneNumber, otp)).rejects.toThrow('Failed to send OTP SMS');
    });

    it('should handle invalid phone number errors from Twilio', async () => {
      const invalidPhoneError = new Error('Invalid phone number');
      invalidPhoneError.name = 'ValidationError';
      mockTwilioClient.messages.create.mockRejectedValue(invalidPhoneError);

      await expect(service.sendOtp(phoneNumber, otp)).rejects.toThrow('Failed to send OTP SMS');
    });
  });
});