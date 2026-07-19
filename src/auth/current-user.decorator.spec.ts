import { ExecutionContext } from '@nestjs/common';
import { getCurrentUserFromContext } from './current-user.decorator';

describe('getCurrentUserFromContext', () => {
  it('should return user from the request', () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockRequest = { user: mockUser };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const result = getCurrentUserFromContext(undefined, mockContext);

    expect(result).toBe(mockUser);
  });

  it('should return undefined if user is not in the request', () => {
    const mockRequest = {};

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const result = getCurrentUserFromContext(undefined, mockContext);

    expect(result).toBeUndefined();
  });
});
