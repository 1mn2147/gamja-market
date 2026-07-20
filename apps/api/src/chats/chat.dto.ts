import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/, { message: 'body must include a non-whitespace character' })
  body!: string;

  @IsOptional()
  @IsUUID('4')
  clientMessageId?: string;
}

export class ChatJoinDto {
  @IsString()
  chatId!: string;
}

export class SendChatMessageDto extends SendMessageDto {
  @IsString()
  chatId!: string;
}
