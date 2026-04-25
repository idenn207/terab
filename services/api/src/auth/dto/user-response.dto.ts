export class UserResponseDto {
  id: string;
  username: string;
  nickname: string;

  constructor(id: string, username: string, nickname: string) {
    this.id = id;
    this.username = username;
    this.nickname = nickname;
  }
}
