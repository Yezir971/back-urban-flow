import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should return validated config when all variables are valid', () => {
    const validConfig = {
      NODE_ENV: 'development',
      PORT: '3000',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_KEY: 'some-key',
      OTP_URL: 'https://otp.example.com',
    };

    const result = validateEnv(validConfig);

    expect(result).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_KEY: 'some-key',
      OTP_URL: 'https://otp.example.com',
    });
  });

  it('should use default values for NODE_ENV and PORT if they are missing', () => {
    const configWithDefaults = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_KEY: 'some-key',
      OTP_URL: 'https://otp.example.com',
    };

    const result = validateEnv(configWithDefaults);

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
  });

  it('should throw an error and log failures if required variables are missing', () => {
    const invalidConfig = {
      PORT: '3000',
    };

    expect(() => validateEnv(invalidConfig)).toThrow(
      new Error(
        '[error] - Environment validation failed. Please check your .env file.',
      ),
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should throw an error if URL variables are not valid URLs', () => {
    const invalidConfig = {
      SUPABASE_URL: 'not-a-url',
      SUPABASE_KEY: 'some-key',
      OTP_URL: 'https://otp.example.com',
    };

    expect(() => validateEnv(invalidConfig)).toThrow(
      new Error(
        '[error] - Environment validation failed. Please check your .env file.',
      ),
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
