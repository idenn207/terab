import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../exceptions/api.exception';
import { ApiExceptionFilter } from './api-exception.filter';

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
const mockGetRequest = jest.fn().mockReturnValue({ url: '/api/test' });
const mockSwitchToHttp = jest.fn().mockReturnValue({
  getResponse: mockGetResponse,
  getRequest: mockGetRequest,
});
const mockContext: any = { switchToHttp: mockSwitchToHttp };

describe('ApiExceptionFilter', () => {
  let filter: ApiExceptionFilter;

  beforeEach(() => {
    filter = new ApiExceptionFilter();
    jest.clearAllMocks();
  });

  it('ApiException을 errorCode와 message가 포함된 응답으로 처리한다', () => {
    const exception = new ApiException('INVALID_CREDENTIALS');

    filter.catch(exception, mockContext);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockJson).toHaveBeenCalledWith({
      errorCode: 'INVALID_CREDENTIALS',
      message: '아이디 또는 비밀번호가 올바르지 않습니다.',
    });
  });
});
