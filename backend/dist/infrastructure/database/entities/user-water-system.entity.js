"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserWaterSystem = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
const water_system_entity_1 = require("./water-system.entity");
let UserWaterSystem = class UserWaterSystem {
    userId;
    waterSystemId;
    createdAt;
    updatedAt;
    user;
    waterSystem;
};
exports.UserWaterSystem = UserWaterSystem;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'user_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], UserWaterSystem.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'water_system_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], UserWaterSystem.prototype, "waterSystemId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], UserWaterSystem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], UserWaterSystem.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.waterSystemLinks, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserWaterSystem.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => water_system_entity_1.WaterSystem, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'water_system_id' }),
    __metadata("design:type", water_system_entity_1.WaterSystem)
], UserWaterSystem.prototype, "waterSystem", void 0);
exports.UserWaterSystem = UserWaterSystem = __decorate([
    (0, typeorm_1.Entity)('user_water_systems')
], UserWaterSystem);
//# sourceMappingURL=user-water-system.entity.js.map