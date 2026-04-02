import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type DB, DRIZZLE } from 'src/database/dizzle.provider';
import { users, user_addresses } from 'src/database/schema';
import { eq, and, sql, SQL, ilike, ne } from 'drizzle-orm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { hash } from 'argon2';

@Injectable()
export class UserService {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findAll(query: GetUsersQueryDto) {
    const { limit, offset, email, name, phone, role } = query;
    const conditions: SQL[] = [eq(users.isDeleted, false)];

    if (email) {
      conditions.push(ilike(users.email, `%${email}%`));
    }
    if (name) {
      conditions.push(ilike(users.name, `%${name}%`));
    }
    if (phone) {
      conditions.push(ilike(users.phone, `%${phone}%`));
    }
    if (role) {
      conditions.push(eq(users.role, role));
    }

    const whereCondition = and(...conditions);

    const data = await this.db.query.users.findMany({
      where: whereCondition,
      limit,
      offset,
      orderBy: (users, { desc }) => [desc(users.createdAt)],
      columns: {
        passwordHash: false,
      },
    });

    const countRes = await this.db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(whereCondition);

    const count = Number(countRes[0].count);

    return {
      count,
      data,
    };
  }

  async findOneById(id: string) {
    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.isDeleted, false)),
      with: {
        addresses: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, ...rest } = user;
    return rest;
  }

  async findOneByEmail(email: string) {
    return await this.db.query.users.findFirst({
      where: and(eq(users.email, email), eq(users.isDeleted, false)),
    });
  }

  async createUser(dto: CreateUserDto) {
    const { password, ...userData } = dto;

    // Check if user already exists
    const existingUser = await this.db.query.users.findFirst({
      where: eq(users.email, userData.email),
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await hash(password);

    const [newUser] = await this.db
      .insert(users)
      .values({
        ...userData,
        passwordHash,
      })
      .returning();

    const { passwordHash: _, ...rest } = newUser;
    return rest;
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.findOneById(id);

    const [updatedUser] = await this.db
      .update(users)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    const { passwordHash: _, ...rest } = updatedUser;
    return rest;
  }

  async deleteUser(id: string) {
    const user = await this.findOneById(id);

    await this.db
      .update(users)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return { message: 'User deleted successfully' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const [updatedUser] = await this.db
      .update(users)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    const { passwordHash: _, ...rest } = updatedUser;
    return rest;
  }

  // Address Management
  async getAddresses(userId: string) {
    return await this.db.query.user_addresses.findMany({
      where: eq(user_addresses.userId, userId),
    });
  }

  async addAddress(userId: string, dto: CreateAddressDto) {
    return await this.db.transaction(async (tx) => {
      if (dto.isDefault) {
        // Unset previous default addresses
        await tx
          .update(user_addresses)
          .set({ isDefault: false })
          .where(eq(user_addresses.userId, userId));
      }

      const [newAddress] = await tx
        .insert(user_addresses)
        .values({
          ...dto,
          userId,
        })
        .returning();

      return newAddress;
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const address = await this.db.query.user_addresses.findFirst({
      where: and(
        eq(user_addresses.id, addressId),
        eq(user_addresses.userId, userId),
      ),
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return await this.db.transaction(async (tx) => {
      if (dto.isDefault) {
        // Unset previous default addresses
        await tx
          .update(user_addresses)
          .set({ isDefault: false })
          .where(and(
            eq(user_addresses.userId, userId),
            ne(user_addresses.id, addressId)
          ));
      }

      const [updatedAddress] = await tx
        .update(user_addresses)
        .set(dto)
        .where(eq(user_addresses.id, addressId))
        .returning();

      return updatedAddress;
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.db.query.user_addresses.findFirst({
      where: and(
        eq(user_addresses.id, addressId),
        eq(user_addresses.userId, userId),
      ),
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    await this.db
      .delete(user_addresses)
      .where(eq(user_addresses.id, addressId));

    return { message: 'Address deleted successfully' };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const address = await this.db.query.user_addresses.findFirst({
      where: and(
        eq(user_addresses.id, addressId),
        eq(user_addresses.userId, userId),
      ),
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return await this.db.transaction(async (tx) => {
      // Unset previous default addresses
      await tx
        .update(user_addresses)
        .set({ isDefault: false })
        .where(eq(user_addresses.userId, userId));

      const [updatedAddress] = await tx
        .update(user_addresses)
        .set({ isDefault: true })
        .where(eq(user_addresses.id, addressId))
        .returning();

      return updatedAddress;
    });
  }
}
