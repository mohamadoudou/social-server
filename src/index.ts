import "reflect-metadata";
import { ApolloServer } from "apollo-server-express";
import connectRedis from "connect-redis";
import cors from "cors";
import express from "express";
import session from "express-session";
import Redis from "ioredis";
import { buildSchema } from "type-graphql";
import { COOKIE_NAME, __prod__ } from "./constants";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Post } from "./entities/Post";
import { Updoot } from "./entities/Updoot";

// Augment express-session with a custom SessionData object
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

export const AppDataSource = new DataSource({
  type: "postgres",
  name: "social-server2",
  username: "postgres",
  password: "root",
  entities: [User, Post, Updoot],
  synchronize: true,
});

const main = async () => {
  // sendEmail("moctarm988@gmail.com", "I love you Nafi");
  AppDataSource.initialize()
    .then(() => {
      console.log("Data Source has been initialized!");
    })
    .catch((error) => console.log(error));

  const app = express();

  const RedisStore = connectRedis(session);
  const redis = new Redis();
  app.use(
    cors({
      origin: ["https://studio.apollographql.com", "http://localhost:3000"],
      credentials: true,
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // one day
        httpOnly: true,
        sameSite: "none", // csrf
        secure: !__prod__, // cookie only works in https
      },
      saveUninitialized: false,
      secret: "keyboard cat",
      resave: false,
    })
  );
  // This line must be remove before deployment to production
  app.set("trust proxy", !__prod__);

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ req, res, redis }),
  });
  // without this, apollo will throw an error.
  await apolloServer.start();
  apolloServer.applyMiddleware({
    app,
    cors: false,
  });
  app.listen(4000, () => {
    console.log("server started on localhost:4000");
  });
};

main().catch((error) => {
  console.log(error);
});
