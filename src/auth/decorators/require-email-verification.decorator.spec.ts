import { UseGuards } from '@nestjs/common';
import { RequireEmailVerification } from './require-email-verification.decorator';
import { EmailVerificationGuard } from '../guards/email-verification.guard';

// Mock the UseGuards decorator
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  UseGuards: jest.fn(),
}));

describe('RequireEmailVerification Decorator', () => {
  const mockUseGuards = UseGuards as jest.MockedFunction<typeof UseGuards>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call UseGuards with EmailVerificationGuard', () => {
    const mockDecorator = jest.fn();
    mockUseGuards.mockReturnValue(mockDecorator);

    const decorator = RequireEmailVerification();

    expect(mockUseGuards).toHaveBeenCalledWith(EmailVerificationGuard);
    expect(decorator).toBe(mockDecorator);
  });

  it('should return a function that can be used as a decorator', () => {
    const mockDecorator = jest.fn();
    mockUseGuards.mockReturnValue(mockDecorator);

    const decorator = RequireEmailVerification();

    expect(typeof decorator).toBe('function');
    expect(decorator).toBe(mockDecorator);
  });

  it('should create a new decorator instance each time it is called', () => {
    const mockDecorator1 = jest.fn();
    const mockDecorator2 = jest.fn();

    mockUseGuards
      .mockReturnValueOnce(mockDecorator1)
      .mockReturnValueOnce(mockDecorator2);

    const decorator1 = RequireEmailVerification();
    const decorator2 = RequireEmailVerification();

    expect(mockUseGuards).toHaveBeenCalledTimes(2);
    expect(decorator1).toBe(mockDecorator1);
    expect(decorator2).toBe(mockDecorator2);
    expect(decorator1).not.toBe(decorator2);
  });

  describe('integration with UseGuards', () => {
    it('should pass EmailVerificationGuard as the only argument to UseGuards', () => {
      RequireEmailVerification();

      expect(mockUseGuards).toHaveBeenCalledWith(EmailVerificationGuard);
      expect(mockUseGuards).toHaveBeenCalledTimes(1);

      const callArgs = mockUseGuards.mock.calls[0];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0]).toBe(EmailVerificationGuard);
    });
  });
});
