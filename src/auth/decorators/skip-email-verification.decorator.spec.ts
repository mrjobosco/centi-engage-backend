import { SetMetadata } from '@nestjs/common';
import {
  SkipEmailVerification,
  SKIP_EMAIL_VERIFICATION_KEY,
} from './skip-email-verification.decorator';

// Mock the SetMetadata decorator
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  SetMetadata: jest.fn(),
}));

describe('SkipEmailVerification Decorator', () => {
  const mockSetMetadata = SetMetadata as jest.MockedFunction<
    typeof SetMetadata
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call SetMetadata with correct key and value', () => {
    const mockDecorator = Object.assign(jest.fn(), {
      KEY: 'skipEmailVerification',
    });
    mockSetMetadata.mockReturnValue(mockDecorator);

    const decorator = SkipEmailVerification();

    expect(mockSetMetadata).toHaveBeenCalledWith(
      SKIP_EMAIL_VERIFICATION_KEY,
      true,
    );
    expect(decorator).toBe(mockDecorator);
  });

  it('should return a function that can be used as a decorator', () => {
    const mockDecorator = Object.assign(jest.fn(), {
      KEY: 'skipEmailVerification',
    });
    mockSetMetadata.mockReturnValue(mockDecorator);

    const decorator = SkipEmailVerification();

    expect(typeof decorator).toBe('function');
    expect(decorator).toBe(mockDecorator);
  });

  it('should create a new decorator instance each time it is called', () => {
    const mockDecorator1 = Object.assign(jest.fn(), {
      KEY: 'skipEmailVerification',
    });
    const mockDecorator2 = Object.assign(jest.fn(), {
      KEY: 'skipEmailVerification',
    });

    mockSetMetadata
      .mockReturnValueOnce(mockDecorator1)
      .mockReturnValueOnce(mockDecorator2);

    const decorator1 = SkipEmailVerification();
    const decorator2 = SkipEmailVerification();

    expect(mockSetMetadata).toHaveBeenCalledTimes(2);
    expect(decorator1).toBe(mockDecorator1);
    expect(decorator2).toBe(mockDecorator2);
    expect(decorator1).not.toBe(decorator2);
  });

  it('should use the correct metadata key constant', () => {
    expect(SKIP_EMAIL_VERIFICATION_KEY).toBe('skipEmailVerification');
  });

  describe('integration with SetMetadata', () => {
    it('should pass correct arguments to SetMetadata', () => {
      SkipEmailVerification();

      expect(mockSetMetadata).toHaveBeenCalledWith(
        'skipEmailVerification',
        true,
      );
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);

      const callArgs = mockSetMetadata.mock.calls[0];
      expect(callArgs).toHaveLength(2);
      expect(callArgs[0]).toBe('skipEmailVerification');
      expect(callArgs[1]).toBe(true);
    });

    it('should always set metadata value to true', () => {
      SkipEmailVerification();
      SkipEmailVerification();
      SkipEmailVerification();

      expect(mockSetMetadata).toHaveBeenCalledTimes(3);
      mockSetMetadata.mock.calls.forEach((call) => {
        expect(call[1]).toBe(true);
      });
    });
  });
});
