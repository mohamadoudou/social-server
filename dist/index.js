"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const apollo_server_express_1 = require("apollo-server-express");
const connect_redis_1 = __importDefault(require("connect-redis"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const ioredis_1 = __importDefault(require("ioredis"));
const type_graphql_1 = require("type-graphql");
const constants_1 = require("./constants");
const hello_1 = require("./resolvers/hello");
const post_1 = require("./resolvers/post");
const user_1 = require("./resolvers/user");
const typeorm_1 = require("typeorm");
const User_1 = require("./entities/User");
const Post_1 = require("./entities/Post");
const Updoot_1 = require("./entities/Updoot");
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    name: "social-server2",
    username: "postgres",
    password: "root",
    entities: [User_1.User, Post_1.Post, Updoot_1.Updoot],
    synchronize: true,
});
const main = async () => {
    exports.AppDataSource.initialize()
        .then(() => {
        console.log("Data Source has been initialized!");
    })
        .catch((error) => console.log(error));
    const app = (0, express_1.default)();
    const RedisStore = (0, connect_redis_1.default)(express_session_1.default);
    const redis = new ioredis_1.default();
    app.use((0, cors_1.default)({
        origin: ["https://studio.apollographql.com", "http://localhost:3000"],
        credentials: true,
    }));
    app.use((0, express_session_1.default)({
        name: constants_1.COOKIE_NAME,
        store: new RedisStore({
            client: redis,
            disableTouch: true,
        }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24,
            httpOnly: true,
            sameSite: "none",
            secure: !constants_1.__prod__,
        },
        saveUninitialized: false,
        secret: "keyboard cat",
        resave: false,
    }));
    app.set("trust proxy", !constants_1.__prod__);
    const apolloServer = new apollo_server_express_1.ApolloServer({
        schema: await (0, type_graphql_1.buildSchema)({
            resolvers: [hello_1.HelloResolver, post_1.PostResolver, user_1.UserResolver],
            validate: false,
        }),
        context: ({ req, res }) => ({ req, res, redis }),
    });
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
//# sourceMappingURL=index.js.map