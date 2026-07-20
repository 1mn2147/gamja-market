import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { AuthenticatedRequest, OptionalSession, SessionGuard } from '../auth/session.guard.js';
import { CreateProductDto, ProductQueryDto, ProductStatusDto, UpdateProductDto } from './product.dto.js';
import { ProductService } from './product.service.js';

type OptionalAuthRequest = { user?: AuthenticatedUser };

@Controller('products')
export class ProductController {
  constructor(@Inject(ProductService) private readonly products: ProductService) {}

  @Get()
  @OptionalSession()
  @UseGuards(SessionGuard)
  list(@Query() query: ProductQueryDto, @Req() request: OptionalAuthRequest) {
    return this.products.list(query, request.user);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  mine(@Req() request: AuthenticatedRequest) {
    return this.products.mine(request.user);
  }

  @Post()
  @UseGuards(SessionGuard)
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateProductDto) {
    return this.products.create(request.user, body);
  }

  @Get(':id')
  @OptionalSession()
  @UseGuards(SessionGuard)
  detail(@Param('id') id: string, @Req() request: OptionalAuthRequest) {
    return this.products.detail(id, request.user);
  }

  @Patch(':id')
  @UseGuards(SessionGuard)
  update(@Param('id') id: string, @Req() request: AuthenticatedRequest, @Body() body: UpdateProductDto) {
    return this.products.update(id, request.user, body);
  }

  @Patch(':id/status')
  @UseGuards(SessionGuard)
  setStatus(@Param('id') id: string, @Req() request: AuthenticatedRequest, @Body() body: ProductStatusDto) {
    return this.products.setStatus(id, request.user, body.status);
  }

  @Delete(':id')
  @UseGuards(SessionGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    await this.products.remove(id, request.user);
  }

  @Get(':id/images/:imageId')
  @OptionalSession()
  @UseGuards(SessionGuard)
  async image(@Param('id') id: string, @Param('imageId') imageId: string, @Req() request: OptionalAuthRequest, @Res() response: Response) {
    const image = await this.products.image(id, imageId, request.user);
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.type(image.mimeType).send(image.data);
  }
}
