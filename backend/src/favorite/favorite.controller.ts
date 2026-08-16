import { Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Put, Query, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FavoriteService } from './favorite.service';
import type { FavoriteListResult } from './favorite.service';
import { listFavoritesQuerySchema } from './favorite.schemas';
import type { ListFavoritesQuery } from './favorite.schemas';

/**
 * 내 찜. 경로가 `/me/*` 라 **주체는 언제나 토큰이 정한다** — 경로에 사용자 id 가 없으므로
 * 남의 찜을 건드릴 표면 자체가 없다.
 *
 * `@Roles` 를 붙이지 않는다. 계약의 `x-role: user` 는 누적형이라 담당자·운영자도 개인으로서
 * 앱을 쓴다 (`backend/README.md` 인가 절).
 */
@Controller('me/favorites')
@UseGuards(AuthGuard)
export class FavoriteController {
  constructor(private readonly favorites: FavoriteService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Query(new ZodValidationPipe(listFavoritesQuerySchema)) query: ListFavoritesQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FavoriteListResult> {
    return this.favorites.list(user.id, query);
  }

  /** 멱등이라 `POST` 가 아니라 `PUT` 이다. 두 번 눌러도 결과가 같다. */
  @Put(':hospitalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  add(@Param('hospitalId') hospitalId: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.favorites.add(user.id, hospitalId);
  }

  @Delete(':hospitalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('hospitalId') hospitalId: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.favorites.remove(user.id, hospitalId);
  }
}
