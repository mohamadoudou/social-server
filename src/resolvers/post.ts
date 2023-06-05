import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  ObjectType,
  Int,
  Mutation,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";
import { Updoot } from "../entities/Updoot";
import { AppDataSource } from "../index";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver()
export class PostResolver {
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;

    const updoot = await Updoot.findOne({ where: { postId, userId } });

    // the user has voted on the post before and
    // they are changing their vote
    if (updoot && updoot.value !== realValue) {
      await AppDataSource.transaction(async (tm) => {
        await tm.query(
          `
      update updoot
      set value = $1
      where "postId"= $2 and "userId"=$3
      `,
          [realValue, postId, userId]
        );

        await tm.query(
          `
      update post
      set points = points + $1
      where id = $2
      `,
          [2 * realValue, postId]
        );
      });
    } else if (!updoot) {
      await AppDataSource.transaction(async (tm) => {
        await tm.query(
          `
    insert into updoot ("userId", "postId", value)
    values ($1, $2,$3)
    `,
          [userId, postId, realValue]
        );
        await tm.query(
          `
    update post
    set points = points + $1
    where id = $2
    `,
          [realValue, postId]
        );
      });
    }

    return true;
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;
    const replacements: any[] = [realLimitPlusOne];

    if (req.session.userId) {
      replacements.push(req.session.userId);
    }
    let cursorIdx = 3;
    if (cursor) {
      replacements.push(new Date(cursor));
      cursorIdx = replacements.length;
    }

    const posts = await AppDataSource.getRepository(Post).query(
      `
      select p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'email', u.email
      ) creator,
      ${
        req.session.userId
          ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"'
          : 'null as "voteStatus"'
      }
      from post p
      inner join public.user u on u.id=p."creatorId"
      ${cursor ? `where p."createdAt"<$${cursorIdx}` : ""}
      order by p."createdAt" DESC
      limit $1
      `,
      replacements
    );

    // 'createdAt', from_unixtime(to_timestamp(u."createdAt")),
    //     'updatedAt', u."updatedAt"
    // const queryBuilder = AppDataSource.getRepository(Post)
    //   .createQueryBuilder("p")
    //   .innerJoinAndSelect("p.creator", "u", 'u.id=p."creatorId"')
    //   .orderBy('"createdAt"', "DESC")
    //   .take(realLimitPlusOne);
    // if (cursor) {
    //   queryBuilder.where('"createdAt" < :cursor', {
    //     cursor: new Date(cursor),
    //   });
    // }
    // const posts = await queryBuilder.getMany();
    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | null> {
    return Post.findOne({ where: { id }, relations: ["creator"] });
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({ ...input, creatorId: req.session.userId }).save();
  }

  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await AppDataSource.getRepository(Post)
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id=:id and "creatorId"=:creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();
    return result.raw[0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    await Post.delete({ id, creatorId: req.session.userId });
    return true;
  }
}
