"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv_1 = require("dotenv");
const typeorm_1 = require("typeorm");
const entities_1 = require("./entities");
const postgres_database_util_1 = require("./postgres-database.util");
(0, dotenv_1.config)();
const connection = (0, postgres_database_util_1.buildTypeOrmPostgresConnection)(process.env.DATABASE_URL ?? '');
exports.default = new typeorm_1.DataSource({
    type: 'postgres',
    url: connection.url,
    ssl: connection.ssl,
    extra: connection.extra,
    entities: entities_1.ALL_ENTITIES,
    migrations: [__dirname + '/migrations/*.{ts,js}'],
    synchronize: false,
});
//# sourceMappingURL=data-source.js.map